import argparse
import cv2
from pathlib import Path
from urllib.request import urlretrieve

from mediapipe import ImageFormat
from mediapipe.tasks.python.core import base_options as base_opts
from mediapipe.tasks.python.vision import FaceDetector, FaceDetectorOptions
from mediapipe.tasks.python.vision.core import image as img_module

from ultralytics import YOLO

from src import smi, video, db


MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"


def _ensure_model(path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading model to {path}...")
        urlretrieve(MODEL_URL, str(path))


def _save_crop(frame, x, y, w, bh, out_dir, video_stem, timestamp, idx):
    crop = frame[max(0, y):y + bh, max(0, x):x + w]
    if crop.size == 0:
        return None
    name = f"{video_stem}_{timestamp:.2f}_{idx}.jpg"
    cv2.imwrite(str(out_dir / name), crop)
    return name


def main(args):
    parser = argparse.ArgumentParser(description="Catch-a-Thief face & person extraction pipeline")
    parser.add_argument("input", help="video file or directory of .avi clips")
    parser.add_argument("--out", default="results", help="output directory (default: results)")
    parser.add_argument("--interval", type=float, default=1.0, help="seconds between sampled frames")
    parser.add_argument("--motion-threshold", type=float, default=0.001, help="min fraction of changed pixels to keep a frame (0.001 = 0.1%%), 0 = disable")
    parser.add_argument("--detect-confidence", type=float, default=0.5, help="MediaPipe min detection confidence")
    parser.add_argument("--person-threshold", type=float, default=0.5, help="YOLO person detection confidence")
    parser.add_argument("--no-faces", action="store_true", help="skip face detection")
    parser.add_argument("--no-persons", action="store_true", help="skip person detection")
    opts = parser.parse_args(args)

    out_dir = Path(opts.out)
    db_path = out_dir / "index.db"
    faces_dir = out_dir / "faces"
    persons_dir = out_dir / "persons"
    out_dir.mkdir(parents=True, exist_ok=True)

    model_path = Path(__file__).parent / "models" / "blaze_face_short_range.tflite"
    _ensure_model(model_path)

    conn = db.init_db(db_path)

    video_paths = smi.resolve_input(opts.input)
    if not video_paths:
        print("No video files found.")
        return 1

    total_faces = 0
    total_persons = 0

    face_detector = None
    if not opts.no_faces:
        faces_dir.mkdir(parents=True, exist_ok=True)
        options = FaceDetectorOptions(
            base_options=base_opts.BaseOptions(model_asset_path=str(model_path)),
            min_detection_confidence=opts.detect_confidence,
        )
        face_detector = FaceDetector.create_from_options(options)

    yolo = None
    if not opts.no_persons:
        persons_dir.mkdir(parents=True, exist_ok=True)
        print("Loading YOLOv8n...")
        yolo_model = Path(__file__).parent / "models" / "yolov8n.pt"
        yolo = YOLO(str(yolo_model))
        try:
            yolo.to("cuda")
        except Exception:
            pass

    for vp in video_paths:
        print(f"Processing: {vp.name}")
        face_count = 0
        person_count = 0
        for ts, frame in video.iter_frames(vp, opts.interval, opts.motion_threshold):
            if face_detector:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = img_module.Image(image_format=ImageFormat.SRGB, data=rgb)
                result = face_detector.detect(mp_image)
                if result.detections:
                    for idx, detection in enumerate(result.detections):
                        bb = detection.bounding_box
                        crop_name = _save_crop(
                            frame, bb.origin_x, bb.origin_y, bb.width, bb.height,
                            faces_dir, vp.stem, ts, idx,
                        )
                        if crop_name is None:
                            continue
                        quality = detection.categories[0].score
                        db.insert_face(conn, vp.name, ts, crop_name, quality)
                        face_count += 1
                        total_faces += 1

            if yolo:
                results = yolo(frame, verbose=False, classes=[0])[0]
                for idx, box in enumerate(results.boxes):
                    conf = float(box.conf[0])
                    if conf < opts.person_threshold:
                        continue
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    w, bh = x2 - x1, y2 - y1
                    crop_name = _save_crop(
                        frame, x1, y1, w, bh,
                        persons_dir, vp.stem, ts, idx,
                    )
                    if crop_name is None:
                        continue
                    db.insert_person(conn, vp.name, ts, crop_name, conf)
                    person_count += 1
                    total_persons += 1

        msg = f"  -> {face_count} faces" if not opts.no_faces else ""
        msg += f", {person_count} persons" if not opts.no_persons else ""
        print(msg)
        conn.commit()

    if face_detector:
        face_detector.close()
    conn.close()

    parts = []
    if not opts.no_faces:
        parts.append(f"{total_faces} faces")
    if not opts.no_persons:
        parts.append(f"{total_persons} persons")
    print(f"\nDone. Processed {len(video_paths)} videos, extracted {', '.join(parts)}.")
    print(f"DB: {db_path}")
    return 0


if __name__ == "__main__":
    exit(main(__import__("sys").argv[1:]))
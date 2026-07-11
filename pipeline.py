import argparse
import cv2
import shutil
from pathlib import Path

from ultralytics import YOLO

from src import smi, video, db


def _save_crop(frame, x, y, w, bh, out_dir, video_stem, timestamp,
               idx, pad=1.0):
    h_f, w_f = frame.shape[:2]
    px, py = int(w * pad), int(bh * pad)
    x1 = max(0, x - px)
    y1 = max(0, y - py)
    x2 = min(w_f, x + w + px)
    y2 = min(h_f, y + bh + py)
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    name = f"{video_stem}_{timestamp:.2f}_{idx}.jpg"
    viz = crop.copy()
    cv2.rectangle(viz, (x - x1, y - y1),
                  (x - x1 + w, y - y1 + bh), (0, 0, 255), 2)
    cv2.imwrite(str(out_dir / name), viz)
    return name


def main(args):
    parser = argparse.ArgumentParser(description="Catch-a-Thief person extraction pipeline")
    parser.add_argument("input", help="video file or directory of .avi clips")
    parser.add_argument("--out", default="results", help="output directory (default: results)")
    parser.add_argument("--interval", type=float, default=1.0, help="seconds between sampled frames")
    parser.add_argument("--motion-threshold", type=float, default=0.001, help="min fraction of changed pixels to keep a frame (0.001 = 0.1%%), 0 = disable")
    parser.add_argument("--person-threshold", type=float, default=0.5, help="YOLO person detection confidence")
    parser.add_argument("--crop-padding", type=float, default=1.0, help="padding ratio around detection (1.0 = 100%% on each side)")
    opts = parser.parse_args(args)

    out_dir = Path(opts.out)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    db_path = out_dir / "index.db"
    persons_dir = out_dir / "persons"
    out_dir.mkdir(parents=True, exist_ok=True)
    persons_dir.mkdir(parents=True, exist_ok=True)

    conn = db.init_db(db_path)

    video_paths = smi.resolve_input(opts.input)
    if not video_paths:
        print("No video files found.")
        return 1

    total_persons = 0

    print("Loading YOLOv8n...")
    yolo_model = Path(__file__).parent / "models" / "yolov8n.pt"
    yolo = YOLO(str(yolo_model))
    try:
        yolo.to("cuda")
    except Exception:
        pass

    for vp in video_paths:
        print(f"Processing: {vp.name}")
        person_count = 0
        for ts, frame in video.iter_frames(vp, opts.interval, opts.motion_threshold):
            results = yolo(frame, verbose=False, classes=[0])[0]
            for idx, box in enumerate(results.boxes):
                conf = float(box.conf[0])
                if conf < opts.person_threshold:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                w, bh = x2 - x1, y2 - y1
                crop_name = _save_crop(
                    frame, x1, y1, w, bh,
                    persons_dir, vp.stem, ts, idx, opts.crop_padding,
                )
                if crop_name is None:
                    continue
                db.insert_person(conn, vp.name, ts, crop_name, conf)
                person_count += 1
                total_persons += 1

        print(f"  -> {person_count} persons")
        conn.commit()

    conn.close()

    print(f"\nDone. Processed {len(video_paths)} videos, extracted {total_persons} persons.")
    print(f"DB: {db_path}")
    return 0


if __name__ == "__main__":
    exit(main(__import__("sys").argv[1:]))

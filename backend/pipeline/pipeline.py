import cv2
import shutil
from pathlib import Path

from ultralytics import YOLO

from . import video, db


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


def run_pipeline(out_dir, video_paths, interval=1.0, motion_threshold=0.001,
                 person_threshold=0.5, crop_padding=1.0, clear_existing=True,
                 models_dir=None, progress_callback=None):
    out_dir = Path(out_dir)
    db_path = out_dir / "index.db"
    persons_dir = out_dir / "persons"
    if clear_existing:
        if db_path.exists():
            db_path.unlink(missing_ok=True)
        if persons_dir.exists():
            shutil.rmtree(persons_dir, ignore_errors=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    persons_dir.mkdir(parents=True, exist_ok=True)

    conn = db.init_db(db_path)

    total_persons = 0

    if models_dir is None:
        models_dir = Path(__file__).resolve().parent.parent.parent / "models"
    yolo = YOLO(str(models_dir / "yolov8n.pt"))
    try:
        yolo.to("cuda")
    except Exception:
        print("CUDA unavailable, falling back to CPU")

    for idx, vp in enumerate(video_paths):
        if progress_callback:
            progress_callback(idx, len(video_paths), vp.name, total_persons)
        person_count = 0
        for ts, frame in video.iter_frames(vp, interval, motion_threshold):
            results = yolo(frame, verbose=False, classes=[0])[0]
            for bidx, box in enumerate(results.boxes):
                conf = float(box.conf[0])
                if conf < person_threshold:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                w, bh = x2 - x1, y2 - y1
                crop_name = _save_crop(
                    frame, x1, y1, w, bh,
                    persons_dir, vp.stem, ts, bidx, crop_padding,
                )
                if crop_name is None:
                    continue
                db.insert_person(conn, vp.name, ts, crop_name, conf)
                person_count += 1
                total_persons += 1
        conn.commit()

    conn.close()
    return total_persons
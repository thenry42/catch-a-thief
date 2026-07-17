import concurrent.futures
import cv2
import logging
import os
import threading
from pathlib import Path

import torch
from ultralytics import YOLO

from . import video, db, smi

logger = logging.getLogger(__name__)


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


_db_locks: dict = {}
_db_locks_lock = threading.Lock()


def _db_lock_for(db_path):
    with _db_locks_lock:
        if db_path not in _db_locks:
            _db_locks[db_path] = threading.Lock()
        return _db_locks[db_path]


def _process_video(vp, yolo, dev, out_dir, interval, motion_threshold,
                   person_threshold, crop_padding, stop_event):
    meta = smi.video_meta(vp)
    camera = meta["camera"]
    date_str = meta["date"]
    video_start = meta["start_time"]

    vid_dir = out_dir / f"CAM{camera}" / date_str
    db_path = vid_dir / "index.db"
    persons_dir = vid_dir / "persons"

    vid_dir.mkdir(parents=True, exist_ok=True)
    persons_dir.mkdir(parents=True, exist_ok=True)

    db_lock = _db_lock_for(str(db_path))
    conn = db.init_db(db_path)

    with db_lock:
        crop_names = db.delete_video_results(conn, vp.name)
        conn.commit()

    for cn in crop_names:
        (persons_dir / cn).unlink(missing_ok=True)

    person_count = 0
    for rel_ts, frame in video.iter_frames(vp, interval, motion_threshold, device=dev):
        if stop_event and stop_event.is_set():
            break
        results = yolo(frame, verbose=False, classes=[0], device=dev)[0]
        for bidx, box in enumerate(results.boxes):
            conf = float(box.conf[0])
            if conf < person_threshold:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            w, bh = x2 - x1, y2 - y1
            abs_ts = video_start + rel_ts
            crop_name = _save_crop(
                frame, x1, y1, w, bh,
                persons_dir, vp.stem, abs_ts, bidx, crop_padding,
            )
            if crop_name is None:
                continue
            with db_lock:
                db.insert_person(conn, vp.name, abs_ts, crop_name, conf)
                person_count += 1

    with db_lock:
        conn.commit()
    conn.close()
    return vp, person_count


def run_pipeline(out_dir, video_paths, interval=3.0, motion_threshold=0.005,
                 person_threshold=0.5, crop_padding=1.0, cpu_threads=2,
                 models_dir=None, stop_event=None,
                 progress_callback=None, max_workers=4):
    os.environ["OMP_NUM_THREADS"] = str(cpu_threads)
    torch.set_num_threads(cpu_threads)
    out_dir = Path(out_dir)
    total_persons = 0

    if models_dir is None:
        models_dir = Path(__file__).resolve().parent.parent.parent / "models"
    yolo = YOLO(str(models_dir / "yolov8n.pt"))

    if torch.cuda.is_available():
        logger.info("CUDA available: %s", torch.cuda.get_device_name(0))
    else:
        logger.warning("CUDA not available, falling back to CPU")

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    yolo.to(dev)

    if stop_event and stop_event.is_set():
        return 0

    total_lock = threading.Lock()

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(
                _process_video, vp, yolo, dev, out_dir, interval,
                motion_threshold, person_threshold, crop_padding, stop_event,
            ): vp
            for vp in video_paths
        }
        for i, future in enumerate(concurrent.futures.as_completed(futures)):
            vp, count = future.result()
            with total_lock:
                total_persons += count
            if progress_callback:
                progress_callback(i, len(video_paths), vp.name, total_persons)

    return total_persons

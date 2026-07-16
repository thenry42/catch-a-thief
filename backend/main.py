import asyncio
import threading
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pipeline import pipeline, db, smi

app = FastAPI()

ANALYSIS_DIR = Path("/app/Analysis")
DATA_DIR = Path("/data")
executor = ThreadPoolExecutor(max_workers=1)

pipeline_status = {"running": False, "last_run": None, "progress": None}
pipeline_lock = threading.Lock()


class PipelineRunParams(BaseModel):
    interval: float = 1.0
    motion_threshold: float = 0.001
    person_threshold: float = 0.5
    crop_padding: float = 1.0
    camera: str = None
    date: str = None


def _scan_tree():
    if not ANALYSIS_DIR.exists():
        return {}
    tree = {}
    for cam_dir in sorted(ANALYSIS_DIR.iterdir()):
        if not cam_dir.is_dir() or not cam_dir.name.startswith("CAM"):
            continue
        camera = cam_dir.name[3:]
        dates = {}
        for date_dir in sorted(cam_dir.iterdir()):
            if not date_dir.is_dir():
                continue
            db_path = date_dir / "index.db"
            if db_path.exists():
                dates[date_dir.name] = db_path
        if dates:
            tree[camera] = dates
    return tree


def _get_db_by_key(camera, date_str):
    db_path = ANALYSIS_DIR / f"CAM{camera}" / date_str / "index.db"
    if not db_path.exists():
        return None
    return db.init_db(db_path)


def _video_meta(video_path):
    meta = smi.video_meta(video_path)
    return {"camera": meta["camera"], "date": meta["date"]}


@app.get("/api/videos")
def list_videos():
    if not DATA_DIR.exists():
        return []
    videos = sorted(DATA_DIR.rglob("*.avi"))
    result = []
    for v in videos:
        rel = v.relative_to(DATA_DIR)
        meta = _video_meta(v)
        result.append({
            "path": str(rel),
            "name": v.name,
            "date": meta["date"],
            "camera": meta["camera"],
        })
    return result


@app.get("/api/files")
def list_files(path: str = Query("")):
    base = (DATA_DIR / path).resolve()
    if not str(base).startswith(str(DATA_DIR.resolve()) + "/") and base != DATA_DIR.resolve():
        raise HTTPException(403, "Path outside data directory")
    if not base.exists() or not base.is_dir():
        raise HTTPException(404, "Directory not found")
    entries = []
    for entry in sorted(base.iterdir()):
        rel = (Path(path) / entry.name) if path else Path(entry.name)
        entries.append({
            "name": entry.name,
            "path": str(rel),
            "is_dir": entry.is_dir(),
        })
    parent = str(Path(path).parent) if path else ""
    if parent == ".":
        parent = ""
    return {"entries": entries, "current_path": path, "parent_path": parent}


@app.get("/api/analysis/tree")
def analysis_tree():
    tree = _scan_tree()
    cameras = []
    for camera in sorted(tree):
        dates = []
        for date_str, db_path in sorted(tree[camera].items()):
            conn = db.init_db(db_path)
            count = conn.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
            conn.close()
            dates.append({"date": date_str, "count": count})
        cameras.append({
            "camera": camera,
            "total": sum(d["count"] for d in dates),
            "dates": dates,
        })
    return {"cameras": cameras}


@app.get("/api/persons")
def query_persons(
    camera: str = None,
    date: str = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100000),
):
    if not camera or not date:
        return {"items": [], "total": 0, "page": page, "per_page": per_page}
    conn = _get_db_by_key(camera, date)
    if conn is None:
        return {"items": [], "total": 0, "page": page, "per_page": per_page}
    offset = (page - 1) * per_page
    total = conn.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
    rows = conn.execute(
        "SELECT id, video_path, timestamp_sec, frame_path, quality_score FROM persons ORDER BY id DESC LIMIT ? OFFSET ?",
        (per_page, offset),
    ).fetchall()
    conn.close()
    return {
        "items": [
            {
                "id": r[0], "video_path": r[1], "timestamp_sec": r[2],
                "frame_path": r[3], "quality_score": r[4],
                "camera": camera, "date": date,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@app.get("/api/persons/{camera}/{date}/{person_id}/image")
def person_image(camera: str, date: str, person_id: int):
    conn = _get_db_by_key(camera, date)
    if conn is None:
        raise HTTPException(404, "No database")
    row = conn.execute("SELECT frame_path FROM persons WHERE id = ?", (person_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, "Person not found")
    img_path = ANALYSIS_DIR / f"CAM{camera}" / date / "persons" / row[0]
    if not img_path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(str(img_path), media_type="image/jpeg")


@app.delete("/api/persons/{camera}/{date}/{person_id}")
def delete_person(camera: str, date: str, person_id: int):
    conn = _get_db_by_key(camera, date)
    if conn is None:
        raise HTTPException(404, "No database")
    row = conn.execute("SELECT frame_path FROM persons WHERE id = ?", (person_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(404, "Person not found")
    img_path = ANALYSIS_DIR / f"CAM{camera}" / date / "persons" / row[0]
    if img_path.exists():
        img_path.unlink()
    conn.execute("DELETE FROM persons WHERE id = ?", (person_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/persons")
def batch_delete_persons(camera: str = None, date: str = None):
    if not camera or not date:
        return {"deleted": 0}
    cam_dir = ANALYSIS_DIR / f"CAM{camera}" / date
    if not cam_dir.exists():
        return {"deleted": 0}
    conn = _get_db_by_key(camera, date)
    if conn is None:
        return {"deleted": 0}
    rows = conn.execute("SELECT frame_path FROM persons").fetchall()
    deleted = len(rows)
    for (fp,) in rows:
        p = cam_dir / "persons" / fp
        if p.exists():
            p.unlink()
    conn.execute("DELETE FROM persons")
    conn.commit()
    conn.close()
    return {"deleted": deleted}


@app.post("/api/pipeline/run")
async def run_pipeline_endpoint(params: PipelineRunParams):
    with pipeline_lock:
        if pipeline_status["running"]:
            raise HTTPException(409, "Pipeline already running")

    video_paths = _resolve_videos("/data") if DATA_DIR.exists() else []
    if not video_paths:
        raise HTTPException(400, "No video files found in /data")

    if params.camera or params.date:
        cameras = set(params.camera.split(",")) if params.camera else None
        dates = set(params.date.split(",")) if params.date else None
        filtered = []
        for vp in video_paths:
            meta = _video_meta(vp)
            if cameras and meta["camera"] not in cameras:
                continue
            if dates and meta["date"] not in dates:
                continue
            filtered.append(vp)
        video_paths = filtered

    if not video_paths:
        raise HTTPException(400, "No video files match the given filters")

    with pipeline_lock:
        pipeline_status["running"] = True
        pipeline_status["last_run"] = None
        pipeline_status["progress"] = None

    loop = asyncio.get_event_loop()

    def _progress(idx, total, name, count):
        with pipeline_lock:
            pipeline_status["progress"] = {
                "current": idx + 1,
                "total": total,
                "video": name,
                "persons_found": count,
            }

    def _run():
        try:
            total = pipeline.run_pipeline(
                out_dir=ANALYSIS_DIR,
                video_paths=video_paths,
                interval=params.interval,
                motion_threshold=params.motion_threshold,
                person_threshold=params.person_threshold,
                crop_padding=params.crop_padding,
                progress_callback=_progress,
            )
            with pipeline_lock:
                pipeline_status["last_run"] = datetime.now().isoformat()
                pipeline_status["progress"] = None
            return total
        except Exception as e:
            with pipeline_lock:
                pipeline_status["last_run"] = f"error: {e}"
            raise
        finally:
            with pipeline_lock:
                pipeline_status["running"] = False

    try:
        total = await loop.run_in_executor(executor, _run)
        return {"total_persons": total}
    except Exception as e:
        raise HTTPException(500, f"Pipeline failed: {e}")


@app.get("/api/pipeline/status")
def pipeline_status_endpoint():
    with pipeline_lock:
        return {
            "running": pipeline_status["running"],
            "last_run": pipeline_status["last_run"],
            "progress": pipeline_status["progress"],
        }


@app.get("/api/stats")
def stats():
    tree = _scan_tree()
    total = 0
    per_day = defaultdict(int)
    per_camera = defaultdict(int)
    for camera, dates in tree.items():
        for date_str, db_path in dates.items():
            conn = db.init_db(db_path)
            count = conn.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
            conn.close()
            total += count
            per_day[date_str] += count
            per_camera[camera] += count
    return {
        "total_persons": total,
        "per_day": [{"date": d, "count": c} for d, c in sorted(per_day.items())],
        "per_camera": [
            {"camera": c, "count": cnt}
            for c, cnt in sorted(per_camera.items(), key=lambda x: -x[1])
        ],
    }


def _resolve_videos(input_path):
    p = Path(input_path)
    if not p.is_dir():
        raise FileNotFoundError(f"Not a directory: {input_path}")
    return sorted(p.rglob("*.avi"))


@app.get("/api/source/tree")
def source_tree():
    if not DATA_DIR.exists():
        return {"cameras": []}
    cameras = []
    for cam_dir in sorted(DATA_DIR.iterdir()):
        if not cam_dir.is_dir() or not cam_dir.name.startswith("CAM"):
            continue
        dates = sorted(
            d.name for d in cam_dir.iterdir()
            if d.is_dir() and any(d.glob("*.avi"))
        )
        cameras.append({"camera": cam_dir.name[3:], "dates": dates})
    return {"cameras": cameras}
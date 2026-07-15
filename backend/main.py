import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pipeline import pipeline, db, smi

app = FastAPI()

RESULTS_DIR = Path("/app/results")
DATA_DIR = Path("/data")
executor = ThreadPoolExecutor(max_workers=1)

pipeline_status = {"running": False, "last_run": None, "progress": None}
pipeline_lock = threading.Lock()


class PipelineRunParams(BaseModel):
    input: str
    interval: float = 1.0
    motion_threshold: float = 0.001
    person_threshold: float = 0.5
    crop_padding: float = 1.0
    clear_existing: bool = True


def _build_person_query(camera, date_from, date_to):
    where = []
    params = []
    if camera:
        where.append("SUBSTR(video_path, 5, 2) = ?")
        params.append(camera)
    if date_from:
        where.append("timestamp_sec >= ?")
        params.append(_date_to_sec(date_from))
    if date_to:
        where.append("timestamp_sec <= ?")
        params.append(_date_to_sec(date_to, end_of_day=True))
    where_clause = " WHERE " + " AND ".join(where) if where else ""
    return where_clause, params


def _camera_from_stem(video_path):
    stem = Path(video_path).stem
    return stem[4:6] if len(stem) >= 6 else stem


def _get_db():
    db_path = RESULTS_DIR / "index.db"
    if not db_path.exists():
        return None
    return db.init_db(db_path)


def _video_meta(video_path):
    smi_info = smi.parse_smi(smi.find_smi(video_path))
    if smi_info:
        return {
            "camera": smi_info["camera"],
            "date": smi_info["start_dt"].strftime("%Y-%m-%d"),
        }
    stem = video_path.stem
    return {
        "camera": stem[4:6] if len(stem) >= 6 else stem,
        "date": str(date.fromtimestamp(video_path.stat().st_mtime)),
    }


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


@app.get("/api/persons")
def query_persons(
    camera: str = None,
    date_from: str = None,
    date_to: str = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    conn = _get_db()
    if conn is None:
        return {"items": [], "total": 0, "page": page, "per_page": per_page}

    where_clause, params = _build_person_query(camera, date_from, date_to)
    offset = (page - 1) * per_page

    total = conn.execute(f"SELECT COUNT(*) FROM persons{where_clause}", params).fetchone()[0]
    rows = conn.execute(
        f"SELECT id, video_path, timestamp_sec, frame_path, quality_score FROM persons{where_clause} ORDER BY id DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    ).fetchall()
    conn.close()

    items = [
        {
            "id": r[0],
            "video_path": r[1],
            "timestamp_sec": r[2],
            "frame_path": r[3],
            "quality_score": r[4],
            "camera": _camera_from_stem(r[1]),
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@app.get("/api/persons/{person_id}/image")
def person_image(person_id: int):
    conn = _get_db()
    if conn is None:
        raise HTTPException(404, "No database")
    row = conn.execute("SELECT frame_path FROM persons WHERE id = ?", (person_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, "Person not found")
    img_path = RESULTS_DIR / "persons" / row[0]
    if not img_path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(str(img_path), media_type="image/jpeg")


@app.delete("/api/persons/{person_id}")
def delete_person(person_id: int):
    conn = _get_db()
    if conn is None:
        raise HTTPException(404, "No database")
    row = conn.execute("SELECT frame_path FROM persons WHERE id = ?", (person_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(404, "Person not found")
    img_path = RESULTS_DIR / "persons" / row[0]
    if img_path.exists():
        img_path.unlink()
    conn.execute("DELETE FROM persons WHERE id = ?", (person_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/persons")
def batch_delete_persons(
    camera: str = None,
    date_from: str = None,
    date_to: str = None,
):
    conn = _get_db()
    if conn is None:
        return {"deleted": 0}

    where_clause, params = _build_person_query(camera, date_from, date_to)

    rows = conn.execute(f"SELECT frame_path FROM persons{where_clause}", params).fetchall()
    for (fp,) in rows:
        p = RESULTS_DIR / "persons" / fp
        if p.exists():
            p.unlink()

    deleted = len(rows)
    conn.execute(f"DELETE FROM persons{where_clause}", params)
    conn.commit()
    conn.close()
    return {"deleted": deleted}


@app.post("/api/pipeline/run")
async def run_pipeline_endpoint(params: PipelineRunParams):
    with pipeline_lock:
        if pipeline_status["running"]:
            raise HTTPException(409, "Pipeline already running")

    video_paths = _resolve_videos(params.input)
    if not video_paths:
        raise HTTPException(400, "No video files found at input path")

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
                out_dir=RESULTS_DIR,
                video_paths=video_paths,
                interval=params.interval,
                motion_threshold=params.motion_threshold,
                person_threshold=params.person_threshold,
                crop_padding=params.crop_padding,
                clear_existing=params.clear_existing,
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
    conn = _get_db()
    if conn is None:
        return {"total_persons": 0, "per_day": [], "per_camera": []}

    total = conn.execute("SELECT COUNT(*) FROM persons").fetchone()[0]

    per_day = conn.execute(
        "SELECT date(timestamp_sec, 'unixepoch') as day, COUNT(*) as cnt FROM persons GROUP BY day ORDER BY day"
    ).fetchall()

    per_camera = conn.execute(
        "SELECT video_path, COUNT(*) as cnt FROM persons GROUP BY video_path ORDER BY cnt DESC"
    ).fetchall()

    conn.close()
    return {
        "total_persons": total,
        "per_day": [{"date": r[0], "count": r[1]} for r in per_day],
        "per_camera": [{"camera": _camera_from_stem(r[0]), "count": r[1]} for r in per_camera],
    }


def _resolve_videos(input_path):
    p = Path(input_path)
    if not p.is_absolute():
        p = DATA_DIR / p
    if p.is_file():
        return [p]
    if p.is_dir():
        return sorted(p.rglob("*.avi"))
    raise FileNotFoundError(f"Not a file or directory: {input_path}")


def _date_to_sec(d, end_of_day=False):
    dt = datetime.strptime(d, "%Y-%m-%d")
    if end_of_day:
        dt = dt.replace(hour=23, minute=59, second=59)
    return dt.timestamp()
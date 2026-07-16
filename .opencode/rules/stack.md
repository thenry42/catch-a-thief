# Stack Decisions

## Problem

2 weeks of CCTV (640+ GB, 2 streams), thousands of people from high-traffic building (3 buildings, school, construction). Cousin believes the thief is known, not a stranger.

## Architecture

```
docker compose up
├── frontend  (nginx → built Vite/React/TS)  → localhost:80
├── backend   (FastAPI + pipeline, GPU-enabled) → localhost:8000
└── volume: ./results/  (shared DB + crop files)
```

Frontend talks to backend via REST API (`/api/...`). Nginx serves the SPA and reverse-proxies `/api` to the backend.

## Frontend — Vite + React + TypeScript

- **Vite** builds to `dist/`
- **nginx** serves `dist/`, reverse-proxies `/api/*` to backend
- **TypeScript 6**, **React 19**, **Vite 8**
- Linting via `oxlint` (`.oxlintrc.json`)
- 4 pages: Dashboard (stats), Browse (gallery with pagination + camera filter), Timeline (date range with grouped thumbnails), Pipeline (run pipeline with params, progress polling, error state)
- Components: `PersonCard` (thumbnail, camera, timestamp, confidence, delete)

## Backend — FastAPI (Python)

Single-worker uvicorn on `python:3.11-slim`. Dependencies pinned to versions from running container.

REST API endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos` | List available `.avi` files by date |
| GET | `/api/persons` | Query persons (camera, date range, page) |
| GET | `/api/persons/{id}/image` | Serve crop thumbnail |
| DELETE | `/api/persons/{id}` | Delete a person entry + crop |
| DELETE | `/api/persons` | Batch delete (by date range, camera) |
| POST | `/api/pipeline/run` | Trigger pipeline with params |
| GET | `/api/pipeline/status` | Check if pipeline is running |
| GET | `/api/stats` | Summary stats (total persons, per day, per camera) |

## Pipeline — YOLOv8n (in-process with backend)

Runs as a Python function called from FastAPI via `ThreadPoolExecutor(max_workers=1)` (blocking in background thread, not `asyncio.to_thread`). Status tracked in-memory with a `threading.Lock()` guarding reads/writes between main and background threads.

- GPU access via host NVIDIA drivers + CDI (`devices: - nvidia.com/gpu=all` in compose), not a CUDA base image. Pipeline auto-falls back to CPU if CUDA unavailable.
- Accepts parameters from frontend: `input`, `interval`, `motion_threshold`, `person_threshold`, `crop_padding`, `clear_existing`
- Per-video progress callback updates in-memory status dict for UI polling
- On error, `last_run` gets `"error: {message}"` string instead of ISO timestamp — frontend displays it raw

Detection flow per video:
1. Frame skipping at configured interval (e.g. 1 fps)
2. Frame-differencing motion filter — skips frames below `motion_threshold`
3. YOLOv8n inference with `classes=[0]` (person class only)
4. Confidence threshold filter
5. Padded crop with bounding box drawn in red
6. Insert into SQLite

## Data Storage — SQLite (shared volume)

```
results/
├── index.db
│   └── persons (
│         id INTEGER PRIMARY KEY AUTOINCREMENT,
│         video_path TEXT,
│         timestamp_sec REAL,
│         frame_path TEXT,
│         quality_score REAL
│       )
└── persons/
    └── {video_stem}_{timestamp:.2f}_{idx}.jpg
```

Frontend never touches `.db` directly. All access through backend API.

## Docker

### `backend/Dockerfile`
- Base: `python:3.11-slim` (not nvidia/cuda — GPU comes from host)
- Install system deps: `libgl1 libglib2.0-0` (OpenCV)
- `pip install` pinned requirements
- Entry: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload` (dev reload, baked in)

### `frontend/Dockerfile`
- Stage 1: `node:20-alpine` — `npm ci && npm run build` (tsc + vite)
- Stage 2: `nginx:alpine` — COPY `dist/` + custom `nginx.conf`

### `docker-compose.yml`

```yaml
services:
  backend:
    build: ./backend
    devices:
      - nvidia.com/gpu=all       # CDI-based GPU passthrough
    volumes:
      - ./results:/app/results   # DB + crops (persistent)
      - ./CCTV:/data           # CCTV footage mount
      - ./models:/app/models     # yolov8n.pt
      - ./backend:/app           # dev: live code reload
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

## Project Structure

```
catch-a-thief/
├── docker-compose.yml
├── .gitignore
├── .opencode/
│   └── rules/
│       ├── stack.md          # this file
│       └── layout.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt      # pinned: opencv 5.0.0.93, ultralytics 8.4.95, fastapi 0.139.0, uvicorn 0.51.0
│   ├── main.py               # FastAPI app (270 lines, 8 endpoints + threading.Lock)
│   └── pipeline/
│       ├── __init__.py
│       ├── pipeline.py       # YOLO detection, crop save, DB insert
│       ├── video.py          # frame iteration + motion skip
│       └── db.py             # SQLite init + insert helpers
├── frontend/
│   ├── Dockerfile
│   ├── .oxlintrc.json
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx           # tab navigation (4 pages)
│       ├── index.css
│       ├── api/
│       │   └── client.ts     # typed fetch wrapper, 9 API methods
│       ├── pages/
│       │   ├── Dashboard.tsx      # totals, per-day, per-camera tables
│       │   ├── Browse.tsx         # gallery grid with camera filter + pagination
│       │   ├── Timeline.tsx       # date range filter, grouped by day
│       │   └── PipelineConfig.tsx # run form + progress polling + error display
│       └── components/
│           └── PersonCard.tsx
├── models/                   # yolov8n.pt (gitignored)
├── results/                  # index.db + persons/ thumbnails (gitignored)
└── CCTV/                   # CCTV footage mount (gitignored)
```

## Key Assumptions

1. Footage is in AVI format (Motion JPEG or similar), not proprietary CCTV formats. Samsung DVR export confirmed by INDEX.HTM.
2. Filename convention: `YYMMDD/HHMMSSCC.avi` (CC = camera number). Two cameras: CAM 01, CAM 04.
3. Date range: 2026-02-22 22:00 through 2026-02-24 ~04:00 (~30 hours, motion-triggered clips).
4. A 1-minute test clip exists to validate the pipeline at small scale.
5. 2-3 second spacing is sufficient at these camera positions.
6. CCTV resolution is too low for face detection — person detection is the right level.
7. Single uvicorn worker (no multiprocessing) — in-memory state is safe per-container.
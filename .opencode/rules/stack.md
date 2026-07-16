# Stack Decisions

## Problem

13 days of CCTV (640+ GB, 2 streams), thousands of people from high-traffic building (3 buildings, school, construction). Cousin believes the thief is known, not a stranger.

## Architecture

```
docker compose up
├── frontend  (nginx → built Vite/React/TS)  → localhost:80
├── backend   (FastAPI + pipeline, GPU-enabled) → localhost:8000
└── volume: ./Analysis/  (shared DB + crop files)
```

Frontend talks to backend via REST API (`/api/...`). Nginx serves the SPA and reverse-proxies `/api` to the backend.

## Frontend — Vite + React + TypeScript

- **Vite** builds to `dist/`
- **nginx** serves `dist/`, reverse-proxies `/api/*` to backend
- **TypeScript 6**, **React 19**, **Vite 8**
- Linting via `oxlint` (`.oxlintrc.json`)
- 4 pages: Dashboard (stats), Analysis (gallery with camera/date filter + pagination), Timeline (date range with grouped thumbnails), Pipeline (run pipeline with params, progress polling, error state)
- Components: `PersonCard` (imageUrl, camera, timestamp, quality, onDelete, onImageClick)

## Backend — FastAPI (Python)

Single-worker uvicorn on `python:3.11-slim`. Dependencies pinned to versions from running container.

REST API endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos` | List available `.avi` files by date |
| GET | `/api/files` | Browse CCTV directory tree |
| GET | `/api/analysis/tree` | Analysis tree with person counts per camera/date |
| GET | `/api/source/tree` | Source video tree grouped by camera/date |
| GET | `/api/persons` | Query persons (camera, date, page) |
| GET | `/api/persons/{camera}/{date}/{person_id}/image` | Serve crop thumbnail |
| DELETE | `/api/persons/{camera}/{date}/{person_id}` | Delete a person entry + crop |
| DELETE | `/api/persons` | Batch delete (by camera, date) |
| POST | `/api/pipeline/run` | Trigger pipeline with params |
| GET | `/api/pipeline/status` | Check if pipeline is running |
| GET | `/api/stats` | Summary stats (total persons, per day, per camera) |

## Pipeline — YOLOv8n (in-process with backend)

Runs as a Python function called from FastAPI via `ThreadPoolExecutor(max_workers=1)` + `loop.run_in_executor()`. Status tracked in-memory with a `threading.Lock()` guarding reads/writes between main and background threads.

- GPU access via host NVIDIA drivers + CDI (`devices: - nvidia.com/gpu=all` in compose), not a CUDA base image. Pipeline auto-falls back to CPU if CUDA unavailable.
- Accepts parameters from frontend: `camera`, `date`, `interval`, `motion_threshold`, `person_threshold`, `crop_padding`
- Per-video progress callback updates in-memory status dict for UI polling
- On error, `last_run` gets `"error: {message}"` string instead of ISO timestamp — frontend displays it raw

Detection flow per video:
1. Frame skipping at configured interval (e.g. 1 fps)
2. Frame-differencing motion filter — skips frames below `motion_threshold`
3. YOLOv8n inference with `classes=[0]` (person class only)
4. Confidence threshold filter
5. Padded crop with bounding box drawn in red
6. Insert into per-date SQLite database

## Data Storage — SQLite (shared volume)

```
Analysis/
├── CAM{camera}/
│   └── {date}/
│       ├── index.db
│       │   └── persons (
│       │         id INTEGER PRIMARY KEY AUTOINCREMENT,
│       │         video_path TEXT,
│       │         timestamp_sec REAL,
│       │         frame_path TEXT,
│       │         quality_score REAL
│       │       )
│       └── persons/
│           └── {video_stem}_{timestamp:.2f}_{idx}.jpg
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
      - ./Analysis:/app/Analysis # DB + crops (persistent)
      - ./CCTV:/data             # CCTV footage mount
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
│   ├── main.py               # FastAPI app (337 lines, 11 endpoints + threading.Lock)
│   └── pipeline/
│       ├── __init__.py
│       ├── pipeline.py       # YOLO detection, crop save, DB insert
│       ├── video.py          # frame iteration + motion skip
│       ├── db.py             # SQLite init + insert helpers
│       └── smi.py            # Samsung DVR SMI subtitle parser
├── frontend/
│   ├── Dockerfile
│   ├── .oxlintrc.json
│   ├── README.md             # Vite scaffolding docs
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx           # tab navigation (4 pages)
│       ├── index.css
│       ├── lib/
│       │   └── utils.ts
│       ├── api/
│       │   └── client.ts     # typed fetch wrapper, 11 API methods
│       ├── pages/
│       │   ├── Dashboard.tsx      # totals, per-day, per-camera tables
│       │   ├── AnalysisBrowser.tsx # gallery grid with camera/date filter + pagination
│       │   ├── Timeline.tsx       # date range filter, grouped by day
│       │   └── PipelineConfig.tsx # run form + progress polling + error display
│       └── components/
│           └── PersonCard.tsx
├── models/                   # yolov8n.pt (gitignored)
├── Analysis/                 # index.db + persons/ thumbnails (gitignored)
└── CCTV/                     # CCTV footage mount (gitignored)
```

## Key Assumptions

1. Footage is in AVI format (Motion JPEG or similar), not proprietary CCTV formats. Samsung DVR export confirmed by INDEX.HTM.
2. Filename convention: `YYMMDD/HHMMSSCC.avi` (CC = camera number). Two cameras: CAM 01, CAM 04. Paired `.smi` subtitle files contain metadata (camera, start time).
3. Date range: 2026-02-22 through 2026-03-06 (13 days, motion-triggered clips).
4. A 1-minute test clip exists to validate the pipeline at small scale.
5. 2-3 second spacing is sufficient at these camera positions.
6. CCTV resolution is too low for face detection — person detection is the right level.
7. Single uvicorn worker (no multiprocessing) — in-memory state is safe per-container.
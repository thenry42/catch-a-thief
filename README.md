# Catch a Thief

A little fucker burglarized my cousin's apartment. We got the CCTV footage, I built this.

Real-world person detection pipeline for 640+ GB of Samsung DVR CCTV footage (13 days, 2 cameras, thousands of people).

**Status:** 3/13 days analyzed, 12,000+ persons detected so far. It's gonna take a while.

## Why This Is Interesting

This isn't a Kaggle dataset with clean labels. It's a messy, real-world surveillance problem with constraints no benchmark prepares you for:

- **No ground truth** — no labeled data, no test set, just raw footage and a hunch
- **Samsung DVR quirks** — metadata lives in `.smi` subtitle files (parsed with regex), not in video headers. Filenames encode camera number (`YYMMDD/HHMMSSCC.avi`)
- **Motion-triggered clips** — variable-length clips (1 min early on, 1-hour blocks daytime). Frame-differencing at 1 fps avoids re-processing near-identical frames across 640+ GB
- **Low-res entrance CCTV** — too grainy for face detection. Person detection (YOLOv8n) is the right level. 2 cameras cover the same entrance from different angles
- **Scale** — 13 days, 640+ GB, thousands of people passing through 3 buildings + a school + construction workers. Constant traffic.

## Background

The reinforced door was broken, only one apartment was targeted, and only small valuables were taken. The thief knew what to steal and when my cousin would be away. Police don't have the resources to process 640 GB of CCTV — and if they did, they wouldn't give me back my 1 TB SSD, which is a fucking disgrace.

My cousin thinks it's someone he knows. I'm leaning toward a construction worker (there's major renovation going on, workers everywhere). Either way, the goal is the same: identify every person who entered over 13 days and let my cousin take a look.

## Stack

- **Backend:** FastAPI (Python), OpenCV 5, Ultralytics YOLOv8n, SQLite
- **Frontend:** Vite 8 + React 19 + TypeScript 6, served by nginx
- **Infra:** Docker Compose, nginx reverse-proxy, GPU passthrough via NVIDIA Container Toolkit (CDI), auto-fallback to CPU

## Project Structure

```
catch-a-thief/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py              # FastAPI app (11 REST endpoints)
│   └── pipeline/
│       ├── pipeline.py      # YOLO detection, crop extraction, DB write
│       ├── video.py         # frame iteration + motion skip
│       ├── db.py            # SQLite helpers
│       └── smi.py           # Samsung DVR SMI subtitle parser
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/client.ts
│       ├── pages/
│       │   ├── Dashboard.tsx         # stats overview
│       │   ├── AnalysisBrowser.tsx   # gallery with filter + pagination
│       │   ├── Timeline.tsx          # date range view
│       │   └── PipelineConfig.tsx    # run pipeline with params
│       └── components/
│           └── PersonCard.tsx
├── models/                 # yolov8n.pt (gitignored)
├── Analysis/               # SQLite DBs + crop thumbnails (gitignored)
└── CCTV/                   # CCTV footage mount (gitignored)
```

## Prerequisites

- **Docker** with Compose plugin
- **NVIDIA GPU + drivers** (optional — pipeline auto-falls back to CPU)

### GPU setup (once)

```bash
# Fedora: install nvidia-container-toolkit
sudo dnf config-manager --add-repo \
  https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo
sudo dnf install -y nvidia-container-toolkit

# Other distros: see https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html

# Enable Docker CDI + generate GPU specs
sudo tee /etc/docker/daemon.json <<<'{"features":{"cdi":true}}'
sudo systemctl restart docker
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
```

### CPU-only machines

Remove the `devices:` block from `docker-compose.yml` — the pipeline detects GPU absence and runs on CPU.

## Usage

```bash
# 1. Download the YOLO model
wget -O models/yolov8n.pt https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt

# 2. Place CCTV footage in CCTV/ (or mount elsewhere)

# 3. Start everything
docker compose up

# 4. Open http://localhost:80
```

Frontend at http://localhost:80. API at http://localhost:8000 (or proxied through nginx).

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos` | List available `.avi` files by date |
| GET | `/api/files` | Browse CCTV directory tree |
| GET | `/api/analysis/tree` | Analysis tree with person counts per camera/date |
| GET | `/api/source/tree` | Source video tree grouped by camera/date |
| GET | `/api/persons` | Query persons (camera, date, page) |
| GET | `/api/persons/{camera}/{date}/{person_id}/image` | Serve crop thumbnail |
| DELETE | `/api/persons/{camera}/{date}/{person_id}` | Delete person entry + crop |
| DELETE | `/api/persons` | Batch delete (by camera, date) |
| POST | `/api/pipeline/run` | Trigger pipeline with params |
| GET | `/api/pipeline/status` | Check if pipeline is running |
| GET | `/api/stats` | Summary stats (total, per day, per camera) |

Pipeline params: `camera`, `date`, `interval`, `motion_threshold`, `person_threshold`, `crop_padding`.

## Detection Pipeline

Per video:
1. Frame skipping at configured interval (default 1 fps)
2. Frame-differencing motion filter — skips static frames
3. YOLOv8n inference (person class only, `classes=[0]`)
4. Confidence threshold filter (default 0.5)
5. Padded crop with red bounding box
6. Insert into per-date SQLite database

## The Dataset

- **Source:** Samsung DVR export (`<title>SAMSUNG DVR: backup file list</title>` in INDEX.HTM)
- **Cameras:** 2 — CAM 01 and CAM 04
- **Date range:** 2026-02-22 through 2026-03-06 (13 days, motion-triggered clips)
- **Size:** 640+ GB total
- **Format:** Motion JPEG AVI at ~4 Mbps, paired `.smi` subtitle files with metadata
- **Naming:** `YYMMDD/HHMMSSCC.avi` (CC = camera number)
- **Traffic:** 3 buildings (15 floors each) + private school + construction workers
- **Resolution:** Too low for reliable face detection
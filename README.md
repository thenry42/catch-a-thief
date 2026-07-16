# Catch a Thief

## Context

A little fucker decided to commit a burglary in my building and steal some valuables from the apartment of my cousin. We managed to retrieve the CCTV footage of the building (2 video streams), according to regulations and the approval of the landlords. I was tasked to isolate faces and timestamps of the visitors to try and catch the thief.

A few problems:
- The burglary was committed over a 2-week period, without any way of knowing when it started or ended.
- There are 2 video streams to analyze.
- The total file size is more than 640 GB.
- The entrances are used by at least 3 buildings of 15 floors. On top of that, a private school is located inside. On top of that, most of these buildings are under renovation, so many entrances are always open and workers are coming and going all the time.

Realistically, I don't see how I could find the thief among thousands of faces to compare, but what makes this burglary unique is that only one apartment was targeted and it almost never happened before, according to the janitor. The door was reinforced and only a few small (but valuable) items were stolen.

My cousin's theory is that he knows the thief, because:
- Only one apartment was targeted.
- The thief knew he was away from home for a while.
- The thief knew what to steal.

I am personally more inclined to believe it was a worker, because:
- Breaking an armored door is no easy task. Police said this particular one was fairly easy to break into, but even knowing that requires skills and knowledge.
- A lot of renovation work is being done (ventilation, insulation, etc.), so lately we've had many workers coming and going inside apartments.
- My cousin might have let the thief know, without realizing it, that he would be away for studies.

For these reasons, I will try to:
- Identify every person in the video streams, hoping that my cousin might recognize someone.
- Find suspicious behavior like unusual movements, eye-contact with CCTV cameras, etc.
- Target people who used the odd-numbered elevator, since the crime was committed on the 9th floor — but even then, the thief (or thieves) could have thought of that and used the stairs or the even-numbered elevator.
- Look for events at night, though workers have the advantage of knowing the location and could act in broad daylight.

It's quite a lot of work that the police would not do, and if they did, they wouldn't give me back my 1 TB SSD, which is a fucking disgrace. But anyway, let's get to work!

## Stack

**Backend:** FastAPI (Python), OpenCV, YOLOv8n, SQLite, GPU-accelerated via CUDA.
**Frontend:** Vite + React + TypeScript, served by nginx.
**Infra:** Docker Compose, nginx reverse-proxy.

## Project Structure

```
catch-a-thief/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py              # FastAPI app (8 REST endpoints)
│   └── pipeline/            # detection code
│       ├── pipeline.py      # YOLO detection, crop extraction, DB write
│       ├── video.py         # frame iteration + motion skip
│       └── db.py            # SQLite helpers
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
│       │   ├── Dashboard.tsx     # stats
│       │   ├── Browse.tsx        # person gallery
│       │   ├── Timeline.tsx      # date range view
│       │   └── PipelineConfig.tsx # run with params
│       └── components/
│           └── PersonCard.tsx
├── models/                 # yolov8n.pt (gitignored)
├── results/                # index.db + persons/ thumbnails (gitignored)
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
| GET | `/api/persons` | Query persons (camera, date range, page) |
| GET | `/api/persons/{id}/image` | Serve crop thumbnail |
| DELETE | `/api/persons/{id}` | Delete a person entry + crop |
| DELETE | `/api/persons` | Batch delete (by date range, camera) |
| POST | `/api/pipeline/run` | Trigger pipeline with params |
| GET | `/api/pipeline/status` | Check if pipeline is running |
| GET | `/api/stats` | Summary stats (total, per day, per camera) |

Pipeline params: `input`, `interval`, `motion_threshold`, `person_threshold`, `crop_padding`, `clear_existing`.

## The Dataset

Samsung DVR export — confirmed by the title `<title>SAMSUNG DVR: backup file list</title>`.
- 2 cameras — CAM 01 and CAM 04
- Date range: 2026-02-22 22:00 through 2026-02-24 ~04:00 (~30 hours)
- Motion-triggered clips (1-2 min early on, 1-hour blocks during daytime)
- Filename convention: `YYMMDD/HHMMSSCC.avi` (CC = camera number)
- ~4 Mbps MJPEG bitrate
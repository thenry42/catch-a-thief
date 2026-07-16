import re
from datetime import date, datetime


def parse_smi(smi_path):
    if not smi_path.exists():
        return None
    text = smi_path.read_text("utf-8", errors="replace")
    m = re.search(
        r"<SYNC Start=0><P Class=ENCC>\s*\n\s*"
        r"CAM\s+(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})",
        text,
    )
    if not m:
        return None
    camera = m.group(1)
    dt = datetime.strptime(m.group(2), "%Y-%m-%d %H:%M:%S")
    return {"camera": camera, "start_time": dt.timestamp(), "start_dt": dt}


def find_smi(video_path):
    return video_path.with_suffix(".smi")


def video_meta(video_path):
    smi_info = parse_smi(find_smi(video_path))
    if smi_info:
        return {
            "camera": smi_info["camera"],
            "date": smi_info["start_dt"].strftime("%Y-%m-%d"),
            "start_time": smi_info["start_time"],
        }
    stem = video_path.stem
    return {
        "camera": stem[-2:] if len(stem) >= 2 else stem,
        "date": str(date.fromtimestamp(video_path.stat().st_mtime)),
        "start_time": 0,
    }
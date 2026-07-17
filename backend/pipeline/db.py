import sqlite3
from pathlib import Path


def init_db(db_path):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS persons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_path TEXT,
            timestamp_sec REAL,
            frame_path TEXT,
            quality_score REAL
        )
    """)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.commit()
    return conn


def insert_person(conn, video_path, timestamp_sec, frame_path, quality_score):
    conn.execute(
        "INSERT INTO persons (video_path, timestamp_sec, frame_path, quality_score) VALUES (?, ?, ?, ?)",
        (video_path, timestamp_sec, frame_path, quality_score),
    )


def delete_video_results(conn, video_name):
    rows = conn.execute("SELECT frame_path FROM persons WHERE video_path = ?", (video_name,)).fetchall()
    conn.execute("DELETE FROM persons WHERE video_path = ?", (video_name,))
    return [r[0] for r in rows]
from pathlib import Path


def resolve_input(path):
    p = Path(path)
    if p.is_file():
        return [p]
    if p.is_dir():
        return sorted(p.rglob("*.avi"))
    raise FileNotFoundError(f"Not a file or directory: {path}")

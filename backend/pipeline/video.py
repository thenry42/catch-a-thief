import cv2


def iter_frames(path, interval_sec=1.0, motion_threshold=0.001):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30

    frame_skip = max(1, int(fps * interval_sec))
    prev_gray = None
    count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if count % frame_skip != 0:
            count += 1
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        if prev_gray is not None:
            diff = cv2.absdiff(prev_gray, gray)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
            changed = cv2.countNonZero(thresh)
            if changed / gray.size < motion_threshold:
                count += 1
                continue

        prev_gray = gray
        yield count / fps, frame
        count += 1

    cap.release()
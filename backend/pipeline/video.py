import cv2
import torch


def iter_frames(path, interval_sec=1.0, motion_threshold=0.001, device="cpu"):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30

    frame_skip = max(1, int(fps * interval_sec))
    prev_gray = None
    count = 0
    use_gpu = device.startswith("cuda") and torch.cuda.is_available()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if count % frame_skip != 0:
            count += 1
            continue

        if use_gpu:
            frame_t = torch.from_numpy(frame).cuda()
            gray = frame_t[:, :, 1].float()
        else:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        if prev_gray is not None:
            if use_gpu:
                diff = (gray - prev_gray).abs()
                changed = (diff > 25).sum().item()
                ratio = changed / gray.numel()
            else:
                diff = cv2.absdiff(prev_gray, gray)
                _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
                changed = cv2.countNonZero(thresh)
                ratio = changed / gray.size
            if ratio < motion_threshold:
                count += 1
                continue

        prev_gray = gray
        yield count / fps, frame
        count += 1

    cap.release()
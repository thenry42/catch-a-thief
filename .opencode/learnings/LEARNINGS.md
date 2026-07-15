# Learnings

Lessons learned the hard way, so we don't go in circles.

## Dockerfile changes are expensive

Any edit to the Dockerfile (or files copied into the image, like `results/` or `models/`) invalidates Docker's build cache — the entire multi-minute image rebuilds from scratch. Think twice before touching it; batch changes into a single edit when possible.
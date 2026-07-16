import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { PipelineStatus, SourceTree } from "../api/client";

const btn: React.CSSProperties = {
  padding: "5px 12px",
  fontSize: 12,
  borderRadius: 3,
  background: "transparent",
  color: "var(--text-dim)",
  cursor: "pointer",
  border: "none",
};

const btnActive: React.CSSProperties = {
  padding: "5px 12px",
  fontSize: 12,
  borderRadius: 3,
  background: "transparent",
  color: "var(--accent)",
  cursor: "pointer",
  border: "1px solid var(--accent)",
};

export function PipelineConfig() {
  const [interval, setInterval] = useState("1.0");
  const [motionThreshold, setMotionThreshold] = useState("0.001");
  const [personThreshold, setPersonThreshold] = useState("0.5");
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [tree, setTree] = useState<SourceTree | null>(null);
  const [selectedCams, setSelectedCams] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  useEffect(() => {
    api.pipelineStatus().then((s) => {
      setStatus(s);
      if (s.running) { setRunning(true); pollContinuously(); }
    }).catch(console.error);
    api.sourceTree().then(setTree).catch(console.error);
  }, []);

  const pollContinuously = () => {
    api.pipelineStatus().then((s) => {
      setStatus(s);
      if (s.running) setTimeout(pollContinuously, 2000);
      else setRunning(false);
    }).catch(console.error);
  };

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const handleRun = async () => {
    setError("");
    setRunning(true);
    try {
      await api.runPipeline({
        interval: parseFloat(interval),
        motion_threshold: parseFloat(motionThreshold),
        person_threshold: parseFloat(personThreshold),
        camera: selectedCams.length ? selectedCams.join(",") : undefined,
        date: selectedDates.length ? selectedDates.join(",") : undefined,
      });
      pollContinuously();
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  };

  const allDates = [...new Set(
    (tree?.cameras ?? [])
      .filter((c) => selectedCams.length === 0 || selectedCams.includes(c.camera))
      .flatMap((c) => c.dates)
  )].sort();

  const canRun = !running && selectedCams.length > 0 && selectedDates.length > 0;

  return (
    <div>
      <h2 style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.5px" }}>
        PIPELINE CONFIGURATION
      </h2>

      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
          CAMERA
          <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
            {(tree?.cameras ?? []).map((c) => (
              <button key={c.camera} style={selectedCams.includes(c.camera) ? btnActive : btn} onClick={() => toggle(selectedCams, c.camera, setSelectedCams)}>
                CAM {c.camera}
              </button>
            ))}
            {selectedCams.length > 0 && <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 4 }}>
              {selectedCams.join(", ")}
            </span>}
          </div>
        </label>

        <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
          DATE
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, alignItems: "center" }}>
            {allDates.map((d) => (
              <button key={d} style={selectedDates.includes(d) ? btnActive : btn} onClick={() => toggle(selectedDates, d, setSelectedDates)}>
                {d}
              </button>
            ))}
            {selectedDates.length > 0 && <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 4 }}>
              {`${selectedDates.length} date(s)`}
            </span>}
          </div>
        </label>

        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
          INTERVAL (seconds)
          <input type="number" step="0.1" value={interval} onChange={(e) => setInterval(e.target.value)} className="terminal-input" />
        </label>
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
          MOTION THRESHOLD
          <input type="number" step="0.0001" value={motionThreshold} onChange={(e) => setMotionThreshold(e.target.value)} className="terminal-input" />
        </label>
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
          PERSON THRESHOLD
          <input type="number" step="0.05" min="0" max="1" value={personThreshold} onChange={(e) => setPersonThreshold(e.target.value)} className="terminal-input" />
        </label>

        <button onClick={handleRun} disabled={!canRun} className="btn-primary" style={{ alignSelf: "flex-start", opacity: canRun ? 1 : 0.4 }}>
          {running ? "RUNNING..." : "RUN PIPELINE"}
        </button>
        {!canRun && !running && <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>select at least one camera and one date</span>}

        {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
      </div>

      {status && (
        <div style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-surface)" }}>
          <h3 style={{ fontSize: 13, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Pipeline Status
          </h3>
          <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              <span style={{ color: "var(--text-dim)" }}>Running: </span>
              <span style={{ color: status.running ? "var(--accent)" : "var(--text-dim)" }}>
                {status.running ? "TRUE" : "FALSE"}
              </span>
            </div>
            {status.last_run && (
              <div>
                <span style={{ color: "var(--text-dim)" }}>Last run: </span>
                <span>{status.last_run}</span>
              </div>
            )}
            {status.progress && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--text-dim)" }}>{status.progress.video}</span>
                  <span style={{ color: "var(--accent)" }}>{status.progress.current}/{status.progress.total}</span>
                </div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(status.progress.current / status.progress.total) * 100}%`, background: "var(--accent)", transition: "width 0.5s" }} />
                </div>
                <div style={{ color: "var(--text-dim)", marginTop: 4 }}>{status.progress.persons_found} persons found</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
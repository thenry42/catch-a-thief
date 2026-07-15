import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { PipelineStatus, FileEntry } from "../api/client";

export function PipelineConfig() {
  const [input, setInput] = useState("/data");
  const [interval, setInterval] = useState("1.0");
  const [motionThreshold, setMotionThreshold] = useState("0.001");
  const [personThreshold, setPersonThreshold] = useState("0.5");
  const [cropPadding, setCropPadding] = useState("1.0");
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState("");

  useEffect(() => {
    api.listFiles().then((r) => {
      setEntries(r.entries);
      setCurrentPath(r.current_path);
      setParentPath(r.parent_path);
    }).catch(console.error);
  }, []);

  const navigate = (path: string, resetInput = false) => {
    api.listFiles(path).then((r) => {
      setEntries(r.entries);
      setCurrentPath(r.current_path);
      setParentPath(r.parent_path);
      if (resetInput) setInput("/data");
    }).catch(console.error);
  };

  const selectItem = (entry: FileEntry) => {
    if (entry.is_dir) {
      navigate(entry.path);
    } else {
      setInput(`/data/${entry.path}`);
    }
  };

  const pollStatus = () => {
    api.pipelineStatus().then((s) => {
      setStatus(s);
      setRunning(s.running);
      if (s.running) setTimeout(pollStatus, 2000);
    }).catch(console.error);
  };

  const handleRun = async () => {
    setError("");
    setRunning(true);
    try {
      await api.runPipeline({
        input,
        interval: parseFloat(interval),
        motion_threshold: parseFloat(motionThreshold),
        person_threshold: parseFloat(personThreshold),
        crop_padding: parseFloat(cropPadding),
      });
      pollStatus();
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.5px" }}>
        PIPELINE CONFIGURATION
      </h2>

      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
          INPUT PATH
          <input value={input} onChange={(e) => setInput(e.target.value)} className="terminal-input" />
        </label>

        <div style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          background: "var(--bg-surface)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 500 }}>
              /data{currentPath && `/${currentPath}`}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {currentPath !== "" && (
                <button onClick={() => navigate(parentPath)} className="btn-small">↑ UP</button>
              )}
              <button onClick={() => navigate(currentPath, true)} className="btn-small">↻</button>
            </div>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {entries.filter((e) => e.is_dir || e.name.endsWith(".avi")).length === 0 && (
              <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 12 }}>Empty directory</p>
            )}
            {entries
              .filter((e) => e.is_dir || e.name.endsWith(".avi"))
              .map((e) => {
                const selected = e.is_dir ? false : input === `/data/${e.path}`;
                return (
                  <div
                    key={e.path}
                    onClick={() => selectItem(e)}
                    style={{
                      padding: "5px 8px",
                      fontSize: 12,
                      cursor: "pointer",
                      borderRadius: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: selected ? "var(--accent-dim)" : "transparent",
                      color: selected ? "var(--accent)" : e.is_dir ? "var(--text-primary)" : "var(--text-dim)",
                    }}
                  >
                    <span>{e.is_dir ? "📁" : "🎬"}</span>
                    {e.name}
                  </div>
                );
              })}
          </div>
        </div>

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
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
          CROP PADDING
          <input type="number" step="0.1" value={cropPadding} onChange={(e) => setCropPadding(e.target.value)} className="terminal-input" />
        </label>

        <button
          onClick={handleRun}
          disabled={running}
          className="btn-primary"
          style={{ alignSelf: "flex-start" }}
        >
          {running ? "RUNNING..." : "RUN PIPELINE"}
        </button>

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
                  <span style={{ color: "var(--text-dim)" }}>
                    {status.progress.video}
                  </span>
                  <span style={{ color: "var(--accent)" }}>
                    {status.progress.current}/{status.progress.total}
                  </span>
                </div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(status.progress.current / status.progress.total) * 100}%`,
                    background: "var(--accent)",
                    transition: "width 0.5s",
                  }} />
                </div>
                <div style={{ color: "var(--text-dim)", marginTop: 4 }}>
                  {status.progress.persons_found} persons found
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
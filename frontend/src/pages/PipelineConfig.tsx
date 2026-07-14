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
      <h2>Pipeline Configuration</h2>

      <div style={{ maxWidth: 500, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Input path:
          <input value={input} onChange={(e) => setInput(e.target.value)} style={inputStyle} />
        </label>

        <div style={browserBox}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              /data{currentPath && `/${currentPath}`}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {currentPath !== "" && (
                <button onClick={() => navigate(parentPath)} style={upBtn}>
                  ↑ Up
                </button>
              )}
              <button onClick={() => navigate(currentPath, true)} style={upBtn}>
                ↻
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {entries.filter((e) => e.is_dir || e.name.endsWith(".avi")).length === 0 && <p style={{ margin: 0, color: "#888", fontSize: 13 }}>Empty directory</p>}
            {entries
              .filter((e) => e.is_dir || e.name.endsWith(".avi"))
              .map((e) => {
                const selected = e.is_dir ? false : input === `/data/${e.path}`;
                return (
                  <div
                    key={e.path}
                    onClick={() => selectItem(e)}
                    style={{
                      ...entryRow,
                      background: selected ? "#e3f2fd" : "transparent",
                      fontWeight: e.is_dir ? 600 : 400,
                    }}
                  >
                    <span style={{ marginRight: 6 }}>{e.is_dir ? "📁" : "🎬"}</span>
                    {e.name}
                  </div>
                );
              })}
          </div>
        </div>

        <label>
          Interval (seconds):
          <input type="number" step="0.1" value={interval} onChange={(e) => setInterval(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Motion threshold:
          <input type="number" step="0.0001" value={motionThreshold} onChange={(e) => setMotionThreshold(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Person threshold:
          <input type="number" step="0.05" min="0" max="1" value={personThreshold} onChange={(e) => setPersonThreshold(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Crop padding:
          <input type="number" step="0.1" value={cropPadding} onChange={(e) => setCropPadding(e.target.value)} style={inputStyle} />
        </label>

        <button
          onClick={handleRun}
          disabled={running}
          style={{
            padding: "10px 20px", background: running ? "#ccc" : "#007bff",
            color: "#fff", border: "none", borderRadius: 6, cursor: running ? "not-allowed" : "pointer",
            fontSize: 16, marginTop: 8,
          }}
        >
          {running ? "Running..." : "Run Pipeline"}
        </button>

        {error && <p style={{ color: "#c00", margin: 0 }}>{error}</p>}
      </div>

      {status && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Status</h3>
          <p>Running: {status.running ? "Yes" : "No"}</p>
          {status.last_run && <p>Last run: {status.last_run}</p>}
          {status.progress && (
            <p>
              Progress: {status.progress.current}/{status.progress.total} — {status.progress.video}
              ({status.progress.persons_found} persons found so far)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: 6, border: "1px solid #ccc",
  borderRadius: 4, marginTop: 4, boxSizing: "border-box",
};

const browserBox: React.CSSProperties = {
  border: "1px solid #ccc", borderRadius: 4, padding: 8, background: "#fafafa",
};

const upBtn: React.CSSProperties = {
  padding: "2px 8px", fontSize: 12, border: "1px solid #ccc",
  borderRadius: 3, background: "#fff", cursor: "pointer",
};

const entryRow: React.CSSProperties = {
  padding: "4px 6px", fontSize: 13, cursor: "pointer", borderRadius: 3,
  display: "flex", alignItems: "center",
};
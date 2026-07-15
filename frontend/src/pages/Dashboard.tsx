import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Stats } from "../api/client";

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2rem 0" }}>
        <div className="radar-spinner" />
        <span className="loading-pulse" style={{ color: "var(--text-dim)", fontSize: 13 }}>ACQUIRING DATA...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-card" style={{ maxWidth: 320, marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>
          Total Persons Detected
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: "var(--accent)" }}>
          {stats.total_persons}
        </div>
      </div>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 13, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            Per Day
          </h3>
          <table className="data-table" style={{ maxWidth: 400 }}>
            <thead>
              <tr><th>Date</th><th>Count</th></tr>
            </thead>
            <tbody>
              {stats.per_day.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style={{ fontSize: 13, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            Per Camera
          </h3>
          <table className="data-table" style={{ maxWidth: 400 }}>
            <thead>
              <tr><th>Camera</th><th>Count</th></tr>
            </thead>
            <tbody>
              {stats.per_camera.map((c) => (
                <tr key={c.camera}>
                  <td>CAM {c.camera}</td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
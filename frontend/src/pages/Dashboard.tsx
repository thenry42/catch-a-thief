import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Stats } from "../api/client";

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(console.error);
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={{ fontSize: 24, fontWeight: "bold", margin: "1rem 0" }}>
        Total Persons: {stats.total_persons}
      </div>

      <h3>Per Day</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 400 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: 8 }}>Date</th>
            <th style={{ padding: 8 }}>Count</th>
          </tr>
        </thead>
        <tbody>
          {stats.per_day.map((d) => (
            <tr key={d.date} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{d.date}</td>
              <td style={{ padding: 8 }}>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Per Camera</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 400 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: 8 }}>Camera</th>
            <th style={{ padding: 8 }}>Count</th>
          </tr>
        </thead>
        <tbody>
          {stats.per_camera.map((c) => (
            <tr key={c.camera} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{c.camera}</td>
              <td style={{ padding: 8 }}>{c.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
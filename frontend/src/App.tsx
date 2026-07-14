import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Browse } from "./pages/Browse";
import { Timeline } from "./pages/Timeline";
import { PipelineConfig } from "./pages/PipelineConfig";

const pages = [
  { key: "dashboard", label: "Dashboard", component: Dashboard },
  { key: "browse", label: "Browse", component: Browse },
  { key: "timeline", label: "Timeline", component: Timeline },
  { key: "pipeline", label: "Pipeline", component: PipelineConfig },
] as const;

export default function App() {
  const [page, setPage] = useState("dashboard");
  const Page = pages.find((p) => p.key === page)?.component ?? Dashboard;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Catch-a-Thief</h1>
      <nav style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "2px solid #ddd" }}>
        {pages.map((p) => (
          <button
            key={p.key}
            onClick={() => setPage(p.key)}
            style={{
              padding: "8px 16px", border: "none", background: "none",
              borderBottom: page === p.key ? "2px solid #007bff" : "2px solid transparent",
              color: page === p.key ? "#007bff" : "#666",
              cursor: "pointer", fontWeight: page === p.key ? 600 : 400,
              marginBottom: -2,
            }}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <Page />
    </div>
  );
}
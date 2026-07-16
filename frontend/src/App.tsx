import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { AnalysisBrowser } from "./pages/AnalysisBrowser";
import { Timeline } from "./pages/Timeline";
import { PipelineConfig } from "./pages/PipelineConfig";

const pages = [
  { key: "dashboard", label: "DASHBOARD", component: Dashboard },
  { key: "analysis", label: "ANALYSIS", component: AnalysisBrowser },
  { key: "timeline", label: "TIMELINE", component: Timeline },
  { key: "pipeline", label: "PIPELINE", component: PipelineConfig },
] as const;

export default function App() {
  const [page, setPage] = useState("dashboard");
  const Page = pages.find((p) => p.key === page)?.component ?? Dashboard;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--accent)", fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
            CATCH-A-THIEF
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: 11, letterSpacing: 2 }}>
            // SURVEILLANCE v1.0
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "pulse-glow 2s infinite" }} />
          <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: 6 }}>REC</span>
        </div>
      </header>

      <nav style={{
        display: "flex",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        paddingLeft: "0.5rem",
      }}>
        {pages.map((p) => (
          <button
            key={p.key}
            onClick={() => setPage(p.key)}
            style={{
              padding: "12px 20px",
              border: "none",
              background: "none",
              color: page === p.key ? "var(--accent)" : "var(--text-dim)",
              borderBottom: page === p.key ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              fontSize: 12,
              letterSpacing: "0.5px",
              fontWeight: page === p.key ? 600 : 400,
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <main style={{
        flex: 1,
        padding: "1.5rem",
        maxWidth: 1200,
        width: "100%",
        margin: "0 auto",
      }}>
        <Page />
      </main>

      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "0.75rem 1.5rem",
        fontSize: 11,
        color: "var(--text-dim)",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span>CATCH-A-THIEF // SURVEILLANCE v1.0</span>
        <span>CLASSIFIED // EYES ONLY</span>
      </footer>
    </div>
  );
}
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../api/client";

export function Timeline() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const perPage = 100;

  useEffect(() => { setPage(1); }, [dateFrom, dateTo]);

  useEffect(() => {
    api.queryPersons({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      per_page: perPage,
    }).then((res) => {
      setPersons(res.items);
      setTotal(res.total);
    }).catch(console.error);
  }, [dateFrom, dateTo, page]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const grouped: Record<string, Person[]> = {};
  persons.forEach((p) => {
    const d = new Date(p.timestamp_sec * 1000).toLocaleDateString();
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(p);
  });

  return (
    <div>
      <h2 style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.5px" }}>
        TIMELINE
      </h2>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>FROM:</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="terminal-input" style={{ width: 180, marginTop: 0 }} />
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>TO:</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="terminal-input" style={{ width: 180, marginTop: 0 }} />
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button className="btn-small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← PREV</button>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>PAGE {page} OF {totalPages} ({total} RECORDS)</span>
        <button className="btn-small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>NEXT →</button>
      </div>

      {Object.entries(grouped).map(([day, items]) => (
        <div key={day} style={{ marginBottom: "1.5rem" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
            paddingBottom: 6,
            borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>{day}</span>
            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{items.length} DETECTIONS</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {items.map((p) => (
              <a
                key={p.id}
                href={api.personImageUrl(p.id)}
                target="_blank"
                rel="noreferrer"
                style={{
                  width: 80,
                  height: 80,
                  overflow: "hidden",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  display: "block",
                }}
              >
                <div className="scan-overlay" style={{ width: "100%", height: "100%" }}>
                  <img
                    src={api.personImageUrl(p.id)}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
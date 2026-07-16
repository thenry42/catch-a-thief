import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../api/client";
import { Button } from "../components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Timeline() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const perPage = 100;

  useEffect(() => { setPage(1); }, [dateFrom, dateTo]);

  const load = useCallback(() => {
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

  useEffect(() => { load(); }, [load]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((i) => (i === null ? null : (i - 1 + persons.length) % persons.length));
  }, [persons.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((i) => (i === null ? null : (i + 1) % persons.length));
  }, [persons.length]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIndex, handlePrev, handleNext]);

  const handleDelete = (id: number) => {
    api.deletePerson(id).then(() => {
      setSelectedIndex(null);
      load();
    });
  };

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
            {items.map((p) => {
              const flatIdx = persons.indexOf(p);
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedIndex(flatIdx)}
                  style={{
                    width: 80,
                    height: 80,
                    overflow: "hidden",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <div className="scan-overlay" style={{ width: "100%", height: "100%" }}>
                    <img
                      src={api.personImageUrl(p.id)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedIndex !== null && persons[selectedIndex] && (
        <div
          onClick={() => setSelectedIndex(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {(() => {
            const p = persons[selectedIndex];
            const dt = new Date(p.timestamp_sec * 1000);
            return (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute", top: 16, left: 16,
                  background: "rgba(0,0,0,0.75)",
                  padding: "12px 16px", borderRadius: 6,
                  fontSize: 12, lineHeight: "1.6",
                  color: "#ccc", zIndex: 10,
                  minWidth: 180,
                }}
              >
                <div style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>{p.camera}</div>
                <div>{dt.toLocaleDateString()} {dt.toLocaleTimeString()}</div>
                <div style={{ marginBottom: 8 }}>CONF: {(p.quality_score * 100).toFixed(0)}%</div>
                <button
                  className="btn-small"
                  style={{ borderColor: "#c33", color: "#c33" }}
                  onClick={() => handleDelete(p.id)}
                >
                  DELETE
                </button>
              </div>
            );
          })()}

          <Button
            variant="outline" size="icon"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            style={{
              position: "absolute", left: 16, top: "50%", translate: "0 -50%",
              width: 48, height: 48, borderRadius: "50%",
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <img
            src={api.personImageUrl(persons[selectedIndex].id)}
            alt={`Person ${persons[selectedIndex].id}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain",
              borderRadius: 4,
            }}
          />

          <Button
            variant="outline" size="icon"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            style={{
              position: "absolute", right: 16, top: "50%", translate: "0 -50%",
              width: 48, height: 48, borderRadius: "50%",
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
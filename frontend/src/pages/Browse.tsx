import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../api/client";
import { PersonCard } from "../components/PersonCard";

export function Browse() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [camera, setCamera] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const perPage = 50;

  const load = () => {
    api.queryPersons({ camera: camera || undefined, page, per_page: perPage }).then((res) => {
      setPersons(res.items);
      setTotal(res.total);
    }).catch(console.error);
  };

  useEffect(() => { load(); }, [page, camera]);

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
    api.deletePerson(id).then(() => load());
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <h2 style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.5px" }}>
        BROWSE PERSONS
      </h2>

      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: 12 }}>
        <input
          placeholder="Filter by camera..."
          value={camera}
          onChange={(e) => { setCamera(e.target.value); setPage(1); }}
          className="terminal-input"
          style={{ width: 250, marginTop: 0 }}
        />
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {total} RECORDS
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "1rem",
      }}>
        {persons.map((p, idx) => (
          <PersonCard
            key={p.id}
            id={p.id}
            imageUrl={api.personImageUrl(p.id)}
            camera={p.camera}
            timestamp={p.timestamp_sec}
            quality={p.quality_score}
            onDelete={handleDelete}
            onImageClick={() => setSelectedIndex(idx)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            className="btn-small"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← PREV
          </button>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            PAGE {page} OF {totalPages}
          </span>
          <button
            className="btn-small"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            NEXT →
          </button>
        </div>
      )}

      {selectedIndex !== null && persons[selectedIndex] && (
        <div
          onClick={() => setSelectedIndex(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            style={{
              position: "absolute", left: 16, top: "50%", translate: "0 -50%",
              background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
              fontSize: 32, width: 48, height: 48, borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ‹
          </button>

          <img
            src={api.personImageUrl(persons[selectedIndex].id)}
            alt={`Person ${persons[selectedIndex].id}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain",
              borderRadius: 4,
            }}
          />

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            style={{
              position: "absolute", right: 16, top: "50%", translate: "0 -50%",
              background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
              fontSize: 32, width: 48, height: 48, borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
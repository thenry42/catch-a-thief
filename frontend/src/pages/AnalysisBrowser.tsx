import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { CameraNode, Person } from "../api/client";
import { PersonCard } from "../components/PersonCard";

type Level = "cameras" | "dates" | "persons";

export function AnalysisBrowser() {
  const [cameras, setCameras] = useState<CameraNode[]>([]);
  const [level, setLevel] = useState<Level>("cameras");
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const perPage = 50;

  useEffect(() => {
    api.analysisTree().then((t) => setCameras(t.cameras)).catch(console.error);
  }, []);

  const selectedCam = cameras.find((c) => c.camera === selectedCamera);

  const loadPersons = useCallback((cam: string, date: string, pg: number) => {
    api.queryPersons({ camera: cam, date, page: pg, per_page: perPage }).then((res) => {
      setPersons(res.items);
      setTotal(res.total);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedCamera && selectedDate) {
      loadPersons(selectedCamera, selectedDate, page);
    }
  }, [selectedCamera, selectedDate, page, loadPersons]);

  const selectCamera = (cam: string) => {
    setSelectedCamera(cam);
    setSelectedDate(null);
    setPage(1);
    setLevel("dates");
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setPage(1);
    setLevel("persons");
  };

  const backToCameras = () => {
    setSelectedCamera(null);
    setSelectedDate(null);
    setLevel("cameras");
  };

  const backToDates = () => {
    setSelectedDate(null);
    setLevel("dates");
  };

  const handleDelete = (id: number) => {
    if (selectedCamera && selectedDate) {
      api.deletePerson(selectedCamera, selectedDate, id).then(() => {
        loadPersons(selectedCamera, selectedDate, page);
      });
    }
  };

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

  const breadcrumb = () => {
    const parts: { label: string; onClick: () => void }[] = [
      { label: "Analysis", onClick: backToCameras },
    ];
    if (selectedCamera) {
      parts.push({
        label: `CAM ${selectedCamera}`,
        onClick: backToDates,
      });
    }
    if (selectedDate) {
      parts.push({ label: selectedDate, onClick: () => {} });
    }
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "1rem", fontSize: 13 }}>
        {parts.map((p, i) => (
          <span key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {i > 0 && <span style={{ color: "var(--text-dim)" }}>/</span>}
            {i < parts.length - 1 ? (
              <button
                onClick={p.onClick}
                style={{
                  background: "none", border: "none", color: "var(--accent)",
                  cursor: "pointer", fontSize: 13, padding: 0,
                  textDecoration: "underline", textUnderlineOffset: 2,
                }}
              >
                {p.label}
              </button>
            ) : (
              <span style={{ color: "var(--text-dim)" }}>{p.label}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  if (cameras.length === 0) {
    return (
      <div>
        <h2 style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.5px" }}>
          ANALYSIS
        </h2>
        <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
          No analysis data found. Run the pipeline first.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600, marginBottom: "0.5rem", letterSpacing: "0.5px" }}>
        ANALYSIS
      </h2>
      {breadcrumb()}

      {level === "cameras" && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {cameras.map((cam) => (
            <div
              key={cam.camera}
              onClick={() => selectCamera(cam.camera)}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "1.5rem",
                minWidth: 200,
                cursor: "pointer",
                background: "var(--bg-surface)",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
                CAM {cam.camera}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                {cam.total} DETECTIONS
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 4 }}>
                {cam.dates.length} DAY{cam.dates.length !== 1 ? "S" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {level === "dates" && selectedCam && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {selectedCam.dates.map((d) => (
            <div
              key={d.date}
              onClick={() => selectDate(d.date)}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.75rem 1rem",
                cursor: "pointer",
                background: "var(--bg-surface)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 14 }}>{d.date}</span>
              <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{d.count} DETECTIONS</span>
            </div>
          ))}
        </div>
      )}

      {level === "persons" && selectedCamera && selectedDate && (
        <div>
          <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: 12 }}>
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
                imageUrl={api.personImageUrl(p.camera, p.date, p.id)}
                camera={p.camera}
                timestamp={p.timestamp_sec}
                quality={p.quality_score}
                onDelete={handleDelete}
                onImageClick={() => setSelectedIndex(idx)}
              />
            ))}
          </div>

          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / perPage));
            if (totalPages <= 1) return null;
            return (
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <button className="btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ← PREV
                </button>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  PAGE {page} OF {totalPages}
                </span>
                <button className="btn-small" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  NEXT →
                </button>
              </div>
            );
          })()}

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
                    <div style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>CAM {p.camera}</div>
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

              <img
                src={api.personImageUrl(persons[selectedIndex].camera, persons[selectedIndex].date, persons[selectedIndex].id)}
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
      )}
    </div>
  );
}
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../api/client";

const DAYS_PER_PAGE = 5;

export function Timeline() {
  const [tree, setTree] = useState<{ camera: string; date: string }[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [camera, setCamera] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleDayCount, setVisibleDayCount] = useState(DAYS_PER_PAGE);

  const cameras = useMemo(() => {
    const set = new Set(tree.map((e) => e.camera));
    return ["", ...set].sort();
  }, [tree]);

  useEffect(() => {
    api.analysisTree().then((t) => {
      const flat: { camera: string; date: string }[] = [];
      for (const cam of t.cameras) {
        for (const d of cam.dates) {
          flat.push({ camera: cam.camera, date: d.date });
        }
      }
      setTree(flat);
    }).catch(console.error);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setVisibleDayCount(DAYS_PER_PAGE);
    const allItems: Person[] = [];
    const cameraFilter = camera || undefined;
    for (const entry of tree) {
      if (cameraFilter && entry.camera !== cameraFilter) continue;
      try {
        const res = await api.queryPersons({
          camera: entry.camera,
          date: entry.date,
          per_page: 1000,
        });
        allItems.push(...res.items);
      } catch (e) { console.error(e); }
    }
    allItems.sort((a, b) => b.timestamp_sec - a.timestamp_sec);
    setPersons(allItems);
    setTotal(allItems.length);
    setLoading(false);
  }, [tree, camera]);

  useEffect(() => { loadAll(); }, [loadAll]);

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
    const p = persons.find((x) => x.id === id);
    if (!p) return;
    api.deletePerson(p.camera, p.date, id).then(() => {
      setSelectedIndex(null);
      loadAll();
    });
  };

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

      <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        {cameras.map((cam) => (
          <button
            key={cam}
            className="btn-small"
            onClick={() => setCamera(cam)}
            style={{
              borderColor: camera === cam ? "var(--accent)" : "var(--border)",
              color: camera === cam ? "var(--accent)" : "var(--text-dim)",
              background: camera === cam ? "rgba(0,255,255,0.08)" : "transparent",
            }}
          >
            {cam ? `CAM ${cam}` : "ALL"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1rem 0" }}>
          <div className="radar-spinner" />
          <span className="loading-pulse" style={{ color: "var(--text-dim)", fontSize: 13 }}>LOADING...</span>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{total} RECORDS</span>
          </div>

          {Object.entries(grouped).slice(0, visibleDayCount).map(([day, items]) => (
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
                          src={api.personImageUrl(p.camera, p.date, p.id)}
                          alt=""
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {visibleDayCount < Object.entries(grouped).length && (
            <div style={{ marginTop: "0.5rem" }}>
              <button className="btn-small" onClick={() => setVisibleDayCount((c) => c + DAYS_PER_PAGE)}>
                LOAD MORE DAYS
              </button>
            </div>
          )}
        </>
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
            src={api.personImageUrl(persons[selectedIndex].camera, persons[selectedIndex].date, persons[selectedIndex].id)}
            alt={`Person ${persons[selectedIndex].id}`}
            loading="lazy"
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
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../api/client";
import { PersonCard } from "../components/PersonCard";

export function Browse() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [camera, setCamera] = useState("");
  const perPage = 50;

  const load = () => {
    api.queryPersons({ camera: camera || undefined, page, per_page: perPage }).then((res) => {
      setPersons(res.items);
      setTotal(res.total);
    }).catch(console.error);
  };

  useEffect(() => { load(); }, [page, camera]);

  const handleDelete = (id: number) => {
    api.deletePerson(id).then(() => load());
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <h2>Browse Persons</h2>

      <div style={{ marginBottom: "1rem" }}>
        <input
          placeholder="Camera name (e.g. 00270120)"
          value={camera}
          onChange={(e) => { setCamera(e.target.value); setPage(1); }}
          style={{ padding: 6, border: "1px solid #ccc", borderRadius: 4, width: 250 }}
        />
        <span style={{ marginLeft: "1rem", color: "#666" }}>
          {total} total
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "1rem",
      }}>
        {persons.map((p) => (
          <PersonCard
            key={p.id}
            id={p.id}
            imageUrl={api.personImageUrl(p.id)}
            camera={p.camera}
            timestamp={p.timestamp_sec}
            quality={p.quality_score}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={btnStyle}>
            Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={btnStyle}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 12px", border: "1px solid #ccc", borderRadius: 4,
  background: "#f5f5f5", cursor: "pointer",
};
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

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);

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
      <h2>Timeline</h2>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <label>From:</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        <label>To:</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>Page {page} of {totalPages} ({total} total)</span>
        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>

      {Object.entries(grouped).map(([day, items]) => (
        <div key={day} style={{ marginBottom: "1.5rem" }}>
          <h3>{day} — {items.length} persons</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {items.map((p) => (
              <a
                key={p.id}
                href={api.personImageUrl(p.id)}
                target="_blank"
                rel="noreferrer"
                style={{ width: 80, height: 80, overflow: "hidden", borderRadius: 4, border: "1px solid #ddd" }}
              >
                <img
                  src={api.personImageUrl(p.id)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 6, border: "1px solid #ccc", borderRadius: 4,
};
interface PersonCardProps {
  id: number;
  imageUrl: string;
  camera: string;
  timestamp: number;
  quality: number;
  onDelete: (id: number) => void;
}

export function PersonCard({ id, imageUrl, camera, timestamp, quality, onDelete }: PersonCardProps) {
  const date = new Date(timestamp * 1000).toLocaleString();
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      <img src={imageUrl} alt={`Person ${id}`} style={{ width: "100%", height: 180, objectFit: "cover" }} />
      <div style={{ padding: "0.5rem", fontSize: 13 }}>
        <div><strong>{camera}</strong></div>
        <div style={{ color: "#666" }}>{date}</div>
        <div style={{ color: "#666" }}>conf: {quality.toFixed(2)}</div>
        <button
          onClick={() => onDelete(id)}
          style={{
            marginTop: 4, padding: "2px 8px", border: "1px solid #ccc",
            borderRadius: 4, background: "#fef0f0", cursor: "pointer", fontSize: 12,
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
interface PersonCardProps {
  id: number;
  imageUrl: string;
  camera: string;
  timestamp: number;
  quality: number;
  onDelete: (id: number) => void;
  onImageClick?: () => void;
}

export function PersonCard({ id, imageUrl, camera, timestamp, quality, onDelete, onImageClick }: PersonCardProps) {
  const date = new Date(timestamp * 1000).toLocaleString();
  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 6,
      overflow: "hidden",
      background: "var(--bg-surface)",
    }}>
      <div
        className="scan-overlay"
        style={{ width: "100%", height: 180, cursor: "pointer" }}
        onClick={onImageClick}
      >
        <img
          src={imageUrl}
          alt={`Person ${id}`}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.9) contrast(1.1)" }}
        />
      </div>
      <div style={{ padding: "0.5rem", fontSize: 12 }}>
        <div style={{ color: "var(--accent)", fontWeight: 600, fontSize: 11, marginBottom: 2 }}>
          CAM {camera}
        </div>
        <div style={{ color: "var(--text-dim)" }}>{date}</div>
        <div style={{ color: "var(--accent)" }}>
          conf: {quality.toFixed(2)}
        </div>
        <button
          onClick={() => onDelete(id)}
          className="btn-danger"
          style={{ marginTop: 6 }}
        >
          DELETE
        </button>
      </div>
    </div>
  );
}
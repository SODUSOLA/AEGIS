export function PulseScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "#22C55E"
    : score >= 60 ? "#3B82F6"
    : score >= 40 ? "#EAB308"
    : score >= 20 ? "#F97316"
    : "#EF4444";

  const label =
    score >= 80 ? "Excellent"
    : score >= 60 ? "Good"
    : score >= 40 ? "Fair"
    : score >= 20 ? "Poor"
    : "Critical";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: `${color}1F`,
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
        }}
      />
      {score}
      <span style={{ opacity: 0.7 }}>{label}</span>
    </span>
  );
}

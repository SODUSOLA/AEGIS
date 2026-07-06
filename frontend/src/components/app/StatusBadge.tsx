export type SubStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED"
  | "EXPIRED";

export const STATUS_COLORS: Record<SubStatus, string> = {
  ACTIVE: "#22C55E",
  TRIALING: "#3B82F6",
  PAST_DUE: "#EAB308",
  SUSPENDED: "#F97316",
  CANCELLED: "#EF4444",
  EXPIRED: "#6B7280",
};

export function StatusBadge({ status }: { status: SubStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      className="font-display"
      style={{
        display: "inline-flex",
        alignItems: "center",
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
      {status.replace("_", " ")}
    </span>
  );
}

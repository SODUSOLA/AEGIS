import { useTheme } from "@/lib/theme";

export function EmptyState({
  label,
  sub,
}: {
  label: string;
  sub?: string;
}) {
  const { tokens } = useTheme();
  return (
    <div
      style={{
        padding: "80px 24px",
        textAlign: "center",
        border: `1px dashed ${tokens.divider}`,
        borderRadius: 16,
      }}
    >
      <div
        className="font-display"
        style={{ fontSize: 18, color: tokens.text, marginBottom: 8 }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 13, color: tokens.muted }}>{sub}</div>
      )}
    </div>
  );
}

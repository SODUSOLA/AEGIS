import type { ReactNode } from "react";

export function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 20,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#6B7280",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: accent ?? "#FFFFFF",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

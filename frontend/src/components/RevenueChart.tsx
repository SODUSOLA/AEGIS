import type { RevenuePoint } from "../api/aegis";

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.revenue + d.recovered));
  const chartH = 180;
  const chartW = "100%";

  const toY = (val: number) => chartH - (val / maxVal) * chartH;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    return { ...d, x: `${x}%`, y: toY(d.revenue) };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 24,
        backdropFilter: "blur(12px)",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#6B7280",
          marginBottom: 16,
        }}
      >
        Revenue Trend (30 days)
      </div>
      <svg
        viewBox={`0 0 1000 ${chartH}`}
        preserveAspectRatio="none"
        style={{ width: chartW, height: chartH, overflow: "visible" }}
      >
        <polyline
          fill="none"
          stroke="#94A3B8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
        {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={chartH + 16}
            textAnchor="middle"
            fill="#6B7280"
            fontSize="10"
            fontFamily="inherit"
          >
            {p.date}
          </text>
        ))}
      </svg>
    </div>
  );
}

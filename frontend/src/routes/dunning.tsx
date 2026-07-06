import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { StatusBadge, type SubStatus } from "@/components/app/StatusBadge";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/dunning")({
  head: () => ({ meta: [{ title: "Dunning — AEGIS" }] }),
  component: DunningPage,
});

type FailureReason = "Insufficient Funds" | "Expired Card" | "Network Timeout";
interface DunningRow {
  customer: string;
  plan: string;
  reason: FailureReason;
  attempt: number;
  next: string;
  status: SubStatus;
}

const ROWS: DunningRow[] = [
  { customer: "emeka@startup.io", plan: "Starter", reason: "Insufficient Funds", attempt: 2, next: "Tomorrow, 09:00am", status: "PAST_DUE" },
  { customer: "funke@media.ng", plan: "Premium", reason: "Expired Card", attempt: 3, next: "—", status: "SUSPENDED" },
  { customer: "chike@retail.ng", plan: "Premium", reason: "Insufficient Funds", attempt: 1, next: "Today, 06:00pm", status: "PAST_DUE" },
  { customer: "bola@agency.com", plan: "Enterprise", reason: "Network Timeout", attempt: 2, next: "In 6 hours", status: "PAST_DUE" },
  { customer: "kemi@shop.ng", plan: "Starter", reason: "Expired Card", attempt: 3, next: "—", status: "SUSPENDED" },
  { customer: "obi@services.ng", plan: "Premium", reason: "Insufficient Funds", attempt: 1, next: "Today, 08:00pm", status: "PAST_DUE" },
];

function DunningPage() {
  const { tokens, mode } = useTheme();
  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg, border: tokens.cardBorder, boxShadow: tokens.cardShadow,
    borderRadius: 12, padding: 20, backdropFilter: "blur(12px)",
  };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: tokens.muted, fontWeight: 500 };

  const reasonColor = (r: FailureReason) => (r === "Insufficient Funds" ? "#EAB308" : r === "Expired Card" ? "#F97316" : "#3B82F6");
  const pill = (text: string, color: string) => (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color, padding: "3px 10px", borderRadius: 9999, background: `${color}1F` }}>
      {text}
    </span>
  );

  const summary = [
    { label: "In Dunning", value: "14", accent: tokens.text },
    { label: "Max Retries Reached", value: "3", accent: "#F97316" },
    { label: "Recovered This Week", value: "11", accent: "#22C55E" },
  ];

  return (
    <AppShell title="Dunning" eyebrow="Dunning Management">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {summary.map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 11, color: tokens.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>{s.label}</div>
            <div className="font-display" style={{ fontSize: 32, fontWeight: 700, color: s.accent, letterSpacing: "-0.01em" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {ROWS.length === 0 ? (
        <div style={{ padding: "80px 24px", textAlign: "center", border: `1px dashed ${tokens.divider}`, borderRadius: 16 }}>
          <div className="font-display" style={{ fontSize: 18, color: tokens.text, marginBottom: 8 }}>No subscriptions in dunning</div>
          <div style={{ fontSize: 13, color: tokens.muted }}>All charges are succeeding</div>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                {["Customer", "Plan", "Failure Reason", "Retry Attempt", "Next Retry", "Status"].map((h) => (<th key={h} style={th}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => {
                const maxed = r.attempt >= 3;
                const barColor = maxed ? "#EF4444" : "#EAB308";
                return (
                  <tr key={i} style={{ borderBottom: i === ROWS.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{r.customer}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{r.plan}</td>
                    <td style={{ padding: "14px 16px" }}>{pill(r.reason, reasonColor(r.reason))}</td>
                    <td style={{ padding: "14px 16px", minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 6 }}>{r.attempt} of 3</div>
                      <div style={{ display: "flex", gap: 3 }}>
                        {[1, 2, 3].map((n) => (
                          <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= r.attempt ? barColor : tokens.divider }} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{r.next}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge status={r.status} />
                      {maxed && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#EF4444" }}>Manual intervention needed</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

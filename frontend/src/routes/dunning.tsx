import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { AppShell } from "@/components/app/AppShell";
import { StatusBadge, type SubStatus } from "@/components/app/StatusBadge";
import { PulseScoreBadge } from "@/components/PulseScoreBadge";
import { useTheme } from "@/lib/theme";
import { aegis } from "@/api/aegis";
import { usePolling } from "@/hooks/usePolling";

export const Route = createFileRoute("/dunning")({
  head: () => ({ meta: [{ title: "Dunning — AEGIS" }] }),
  component: DunningPage,
});

type FailureReason = "Insufficient Funds" | "Expired Card" | "Network Timeout" | "Card Declined";
interface DunningRow {
  id: string;
  customer: string;
  plan: string;
  reason: FailureReason;
  attempt: number;
  maxAttempts: number;
  nextRetry: string;
  status: SubStatus;
}

function DunningPage() {
  const { tokens, mode } = useTheme();

  const { data: rows, refresh } = usePolling<DunningRow[]>(() => aegis.getDunning() as Promise<DunningRow[]>, 30000);

  const pastDue = (rows ?? []).filter((r) => r.status === "PAST_DUE");
  const suspended = (rows ?? []).filter((r) => r.status === "SUSPENDED");

  const handleRetry = useCallback(async (subId: string) => {
    try {
      await aegis.triggerManualRetry(subId);
      refresh();
    } catch {}
  }, [refresh]);

  const handleReactivate = useCallback(async (subId: string) => {
    try {
      await aegis.reactivateSubscription(subId);
      refresh();
    } catch {}
  }, [refresh]);

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg, border: tokens.cardBorder, boxShadow: tokens.cardShadow,
    borderRadius: 12, padding: 20, backdropFilter: "blur(12px)",
  };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: tokens.muted, fontWeight: 500 };

  const reasonColor = (r: string) =>
    r === "Insufficient Funds" ? "#EAB308" :
    r === "Expired Card" ? "#F97316" :
    r === "Network Timeout" ? "#3B82F6" :
    "#EF4444";

  const pill = (text: string, color: string) => (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color, padding: "3px 10px", borderRadius: 9999, background: `${color}1F` }}>
      {text}
    </span>
  );

  const summary = [
    { label: "In Dunning", value: String(rows?.length ?? 0), accent: tokens.text },
    { label: "Max Retries Reached", value: String((rows ?? []).filter((r) => r.attempt >= r.maxAttempts).length), accent: "#F97316" },
    { label: "Past Due", value: String(pastDue.length), accent: "#EAB308" },
  ];

  const renderTable = (data: DunningRow[], sectionLabel: string, showRetry: boolean, showReactivate: boolean) => {
    if (data.length === 0) return null;
    return (
      <section style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.3em", textTransform: "uppercase", color: tokens.accent, marginBottom: 16 }}>
          {sectionLabel}
        </div>
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                {["Customer", "Plan", "Failure Reason", "Retry Attempt", "Next Retry", "Status", ""].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => {
                const maxed = r.attempt >= r.maxAttempts;
                const barColor = maxed ? "#EF4444" : "#EAB308";
                return (
                  <tr key={r.id} style={{ borderBottom: i === data.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{r.customer}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{r.plan}</td>
                    <td style={{ padding: "14px 16px" }}>{pill(r.reason, reasonColor(r.reason))}</td>
                    <td style={{ padding: "14px 16px", minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 6 }}>{r.attempt} of {r.maxAttempts}</div>
                      <div style={{ display: "flex", gap: 3 }}>
                        {Array.from({ length: r.maxAttempts }, (_, n) => (
                          <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n < r.attempt ? barColor : tokens.divider }} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{r.nextRetry}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge status={r.status} />
                      {maxed && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#EF4444" }}>Manual intervention needed</div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {showRetry && (
                        <button
                          onClick={() => handleRetry(r.id)}
                          style={{
                            background: "transparent",
                            border: `1px solid ${tokens.divider}`,
                            color: tokens.text,
                            padding: "6px 14px",
                            borderRadius: 9999,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Retry Now
                        </button>
                      )}
                      {showReactivate && (
                        <button
                          onClick={() => handleReactivate(r.id)}
                          style={{
                            background: "transparent",
                            border: `1px solid #22C55E55`,
                            color: "#22C55E",
                            padding: "6px 14px",
                            borderRadius: 9999,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

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

      {(!rows || rows.length === 0) ? (
        <div style={{ padding: "80px 24px", textAlign: "center", border: `1px dashed ${tokens.divider}`, borderRadius: 16 }}>
          <div className="font-display" style={{ fontSize: 18, color: tokens.text, marginBottom: 8 }}>No subscriptions in dunning</div>
          <div style={{ fontSize: 13, color: tokens.muted }}>All charges are succeeding</div>
        </div>
      ) : (
        <>
          {renderTable(pastDue, "Past Due", true, false)}
          {renderTable(suspended, "Suspended", false, true)}
        </>
      )}
    </AppShell>
  );
}

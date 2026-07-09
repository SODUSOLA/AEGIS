import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useCallback } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { AppShell } from "@/components/app/AppShell";
import { StatusBadge, STATUS_COLORS, type SubStatus } from "@/components/app/StatusBadge";
import { PulseScoreBadge } from "@/components/PulseScoreBadge";
import { RevenueChart } from "@/components/RevenueChart";
import { aegis } from "@/api/aegis";
import { usePolling } from "@/hooks/usePolling";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AEGIS" }] }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <AppShell title="Dashboard" eyebrow="Overview">
      <DashboardContent />
    </AppShell>
  );
}

interface Metric {
  label: string;
  value: string;
  trend: string;
  trendColor: string;
  direction: "up" | "down";
  sublabel?: string;
}

interface StateBreak {
  status: string;
  count: number;
  color: string;
}

interface AtRiskSub {
  id: string;
  customer: string;
  plan: string;
  pulseScore: number;
  status: string;
  nextRetry: string;
  attempt: number;
  maxAttempts: number;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { tokens } = useTheme();
  return (
    <div
      style={{
        background: tokens.cardBg,
        border: tokens.cardBorder,
        boxShadow: tokens.cardShadow,
        borderRadius: 16,
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: tokens.accent,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function DashboardContent() {
  const { tokens } = useTheme();

  const fetchOverview = useCallback(() => aegis.getOverview(), []);
  const fetchRevenue = useCallback(() => aegis.getRevenueTrend(), []);
  const fetchAtRisk = useCallback(() => aegis.getAtRisk(), []);
  const { data: overview } = usePolling(fetchOverview, 30000);
  const { data: revenueData } = usePolling(fetchRevenue, 30000);
  const { data: atRisk } = usePolling(fetchAtRisk, 30000);

  const metrics = overview?.metrics ?? [];
  const stateBreakdown = overview?.stateBreakdown ?? [];
  const events = overview?.activity ?? [];
  const transactions = overview?.transactions ?? [];
  const atRiskList = atRisk ?? [];

  const totalState = stateBreakdown.reduce((s, x) => s + x.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {/* Metric cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card style={{ padding: 20 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: tokens.muted,
                  marginBottom: 12,
                }}
              >
                {m.label}
              </div>
              <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: tokens.text, marginBottom: 8 }}>
                {m.value}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: m.trendColor }}>
                {m.direction === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{m.trend}</span>
                {m.sublabel && <span style={{ color: tokens.muted, marginLeft: 4 }}>{m.sublabel}</span>}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Subscription states */}
      {stateBreakdown.length > 0 && (
        <section>
          <SectionLabel>Subscription States</SectionLabel>
          <Card style={{ padding: 24 }}>
            <div
              style={{
                display: "flex",
                height: 10,
                borderRadius: 9999,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              {stateBreakdown.map((s) => (
                <div
                  key={s.status}
                  style={{
                    width: `${(s.count / totalState) * 100}%`,
                    background: s.color,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              {stateBreakdown.map((s) => (
                <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 9999,
                      background: s.color,
                    }}
                  />
                  <span style={{ color: tokens.text, fontWeight: 600 }}>{s.status.replace("_", " ")}</span>
                  <span style={{ color: tokens.muted }}>{s.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Revenue chart */}
      {revenueData && (
        <section>
          <RevenueChart data={revenueData} />
        </section>
      )}

      {/* At Risk */}
      {atRiskList.length > 0 && (
        <section>
          <SectionLabel>At Risk</SectionLabel>
          <Card style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                  {["Customer", "Plan", "Status", "Pulse Score", "Next Retry", "Attempt"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: tokens.muted,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atRiskList.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: i < atRiskList.length - 1 ? `1px solid ${tokens.divider}` : "none",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{r.customer}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{r.plan}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge status={r.status as SubStatus} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <PulseScoreBadge score={r.pulseScore} />
                    </td>
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{r.nextRetry}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>
                      {r.attempt}/{r.maxAttempts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* Activity + Transactions side by side on wide screens */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 32 }}>
        {/* Live activity */}
        <section>
          <SectionLabel>Live Activity</SectionLabel>
          <Card>
            {events.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 20px",
                  borderBottom: i < events.length - 1 ? `1px solid ${tokens.divider}` : "none",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: e.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: tokens.text, fontWeight: 500 }}>{e.type}</div>
                  <div style={{ fontSize: 12, color: tokens.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.customer}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: tokens.muted, flexShrink: 0 }}>{e.time}</span>
              </div>
            ))}
          </Card>
        </section>

        {/* Recent transactions */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>Recent Transactions</SectionLabel>
            <Link to="/transactions" style={{ fontSize: 12, color: tokens.accent, marginBottom: 16 }}>
              View all →
            </Link>
          </div>
          <Card style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                  {["Customer", "Plan", "Amount", "Status", "Time"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: tokens.muted,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i < transactions.length - 1 ? `1px solid ${tokens.divider}` : "none",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{t.customer}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{t.plan}</td>
                    <td style={{ padding: "14px 16px", color: tokens.text, fontVariantNumeric: "tabular-nums" }}>{t.amount}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge status={t.status as SubStatus} />
                    </td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{t.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </div>
  );
}

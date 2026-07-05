import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { AppShell } from "@/components/app/AppShell";
import { StatusBadge, STATUS_COLORS, type SubStatus } from "@/components/app/StatusBadge";

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

const METRICS: Metric[] = [
  { label: "Active Subscriptions", value: "284", trend: "+12%", trendColor: "#22C55E", direction: "up" },
  { label: "MRR", value: "₦1,420,000", trend: "+8%", trendColor: "#22C55E", direction: "up" },
  { label: "Churn Rate", value: "2.4%", trend: "-0.3%", trendColor: "#22C55E", direction: "down" },
  { label: "Failed Charges", value: "17", trend: "+3", trendColor: "#EF4444", direction: "up", sublabel: "today" },
  { label: "Recovered Charges", value: "11", trend: "64% recovery", trendColor: "#94A3B8", direction: "up", sublabel: "today" },
];

const STATE_BREAKDOWN: { status: SubStatus; count: number }[] = [
  { status: "ACTIVE", count: 248 },
  { status: "TRIALING", count: 34 },
  { status: "PAST_DUE", count: 12 },
  { status: "SUSPENDED", count: 5 },
  { status: "CANCELLED", count: 8 },
  { status: "EXPIRED", count: 3 },
];

const EVENTS = [
  { type: "charge.recovered", color: "#22C55E", customer: "adebayo@gmail.com", time: "2 mins ago" },
  { type: "subscription.activated", color: "#22C55E", customer: "chioma@techcorp.ng", time: "5 mins ago" },
  { type: "subscription.past_due", color: "#EAB308", customer: "emeka@startup.io", time: "12 mins ago" },
  { type: "charge.failed", color: "#EF4444", customer: "funke@media.ng", time: "18 mins ago" },
  { type: "subscription.activated", color: "#22C55E", customer: "tunde@saas.com", time: "31 mins ago" },
  { type: "charge.succeeded", color: "#22C55E", customer: "ngozi@fintech.ng", time: "45 mins ago" },
];

const TX: { customer: string; plan: string; amount: string; status: SubStatus; time: string }[] = [
  { customer: "Adebayo Okonkwo", plan: "Pro Monthly", amount: "₦15,000", status: "ACTIVE", time: "2m ago" },
  { customer: "Chioma Eze", plan: "Enterprise", amount: "₦85,000", status: "ACTIVE", time: "8m ago" },
  { customer: "Emeka Nwosu", plan: "Pro Monthly", amount: "₦15,000", status: "PAST_DUE", time: "12m ago" },
  { customer: "Funke Adeyemi", plan: "Starter", amount: "₦5,000", status: "CANCELLED", time: "1h ago" },
  { customer: "Tunde Bakare", plan: "Pro Annual", amount: "₦150,000", status: "TRIALING", time: "2h ago" },
  { customer: "Ngozi Okafor", plan: "Pro Monthly", amount: "₦15,000", status: "ACTIVE", time: "3h ago" },
];

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
  const total = STATE_BREAKDOWN.reduce((s, x) => s + x.count, 0);

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
        {METRICS.map((m, i) => (
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
            {STATE_BREAKDOWN.map((s) => (
              <div
                key={s.status}
                style={{
                  width: `${(s.count / total) * 100}%`,
                  background: STATUS_COLORS[s.status],
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            {STATE_BREAKDOWN.map((s) => (
              <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background: STATUS_COLORS[s.status],
                  }}
                />
                <span style={{ color: tokens.text, fontWeight: 600 }}>{s.status.replace("_", " ")}</span>
                <span style={{ color: tokens.muted }}>{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Activity + Transactions side by side on wide screens */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 32 }}>
        {/* Live activity */}
        <section>
          <SectionLabel>Live Activity</SectionLabel>
          <Card>
            {EVENTS.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 20px",
                  borderBottom: i < EVENTS.length - 1 ? `1px solid ${tokens.divider}` : "none",
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
                {TX.map((t, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i < TX.length - 1 ? `1px solid ${tokens.divider}` : "none",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{t.customer}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{t.plan}</td>
                    <td style={{ padding: "14px 16px", color: tokens.text, fontVariantNumeric: "tabular-nums" }}>{t.amount}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge status={t.status} />
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

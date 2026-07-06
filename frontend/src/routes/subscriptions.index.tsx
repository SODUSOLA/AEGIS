import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";
import { StatusBadge, type SubStatus } from "@/components/app/StatusBadge";

export const Route = createFileRoute("/subscriptions/")({
  head: () => ({ meta: [{ title: "Subscriptions — AEGIS" }] }),
  component: SubscriptionsRoute,
});

interface Sub {
  id: string;
  customer: string;
  plan: string;
  status: SubStatus;
  periodStart: string;
  periodEnd: string;
  lastCharged: string;
  nextCharge: string;
}

const ROWS: Sub[] = [
  { id: "sub_01", customer: "adebayo@gmail.com", plan: "Premium", status: "ACTIVE", periodStart: "Jun 01", periodEnd: "Jul 01", lastCharged: "Jun 01, 2026", nextCharge: "Jul 01, 2026" },
  { id: "sub_02", customer: "chioma@techcorp.ng", plan: "Enterprise", status: "TRIALING", periodStart: "Jun 24", periodEnd: "Jul 08", lastCharged: "—", nextCharge: "Jul 08, 2026" },
  { id: "sub_03", customer: "emeka@startup.io", plan: "Starter", status: "PAST_DUE", periodStart: "May 18", periodEnd: "Jun 18", lastCharged: "May 18, 2026", nextCharge: "Jun 21, 2026" },
  { id: "sub_04", customer: "funke@media.ng", plan: "Premium", status: "SUSPENDED", periodStart: "May 05", periodEnd: "Jun 05", lastCharged: "May 05, 2026", nextCharge: "—" },
  { id: "sub_05", customer: "tunde@saas.com", plan: "Enterprise", status: "CANCELLED", periodStart: "Apr 12", periodEnd: "May 12", lastCharged: "Apr 12, 2026", nextCharge: "—" },
  { id: "sub_06", customer: "ngozi@fintech.ng", plan: "Starter", status: "ACTIVE", periodStart: "Jun 14", periodEnd: "Jul 14", lastCharged: "Jun 14, 2026", nextCharge: "Jul 14, 2026" },
];

function SubscriptionsRoute() {
  const { tokens, mode } = useTheme();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("All");
  const [plan, setPlan] = useState<string>("All");
  const [query, setQuery] = useState("");
  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";

  const filtered = useMemo(
    () =>
      ROWS.filter((r) => (status === "All" || r.status === status) && (plan === "All" || r.plan === plan) && (query === "" || r.customer.includes(query.toLowerCase()))),
    [status, plan, query],
  );

  const selectStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${tokens.divider}`,
    borderRadius: 10,
    padding: "10px 14px",
    color: tokens.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    cursor: "pointer",
  };

  return (
    <AppShell title="Subscriptions" eyebrow="Subscription Management">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          {["All", "ACTIVE", "TRIALING", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"].map((s) => (
            <option key={s} value={s}>{s === "All" ? "All statuses" : s.replace("_", " ")}</option>
          ))}
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} style={selectStyle}>
          {["All", "Starter", "Premium", "Enterprise"].map((p) => (
            <option key={p} value={p}>{p === "All" ? "All plans" : p}</option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", position: "relative", minWidth: 260 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tokens.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer email..."
            style={{ ...selectStyle, width: "100%", paddingLeft: 34 }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState label="No subscriptions yet" />
      ) : (
        <div style={{ background: tokens.cardBg, border: tokens.cardBorder, borderRadius: 16, overflow: "hidden", boxShadow: tokens.cardShadow, backdropFilter: "blur(12px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                {["Customer", "Plan", "Status", "Current Period", "Last Charged", "Next Charge"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "14px 20px", fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: tokens.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => navigate({ to: "/subscriptions/$id", params: { id: r.id } })}
                  style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.divider}` : "none", cursor: "pointer", transition: "background 150ms ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "16px 20px", color: tokens.text }}>{r.customer}</td>
                  <td style={{ padding: "16px 20px", color: tokens.muted }}>{r.plan}</td>
                  <td style={{ padding: "16px 20px" }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: "16px 20px", color: tokens.muted, fontVariantNumeric: "tabular-nums" }}>{r.periodStart} → {r.periodEnd}</td>
                  <td style={{ padding: "16px 20px", color: tokens.muted }}>{r.lastCharged}</td>
                  <td style={{ padding: "16px 20px", color: tokens.text }}>{r.nextCharge}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ label, sub }: { label: string; sub?: string }) {
  const { tokens } = useTheme();
  return (
    <div style={{ padding: "80px 24px", textAlign: "center", border: `1px dashed ${tokens.divider}`, borderRadius: 16 }}>
      <div className="font-display" style={{ fontSize: 18, color: tokens.text, marginBottom: 8 }}>{label}</div>
      {sub && <div style={{ fontSize: 13, color: tokens.muted }}>{sub}</div>}
    </div>
  );
}
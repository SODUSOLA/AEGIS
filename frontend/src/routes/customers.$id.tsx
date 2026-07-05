import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { StatusBadge, type SubStatus } from "@/components/app/StatusBadge";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/customers/$id")({
  head: () => ({ meta: [{ title: "Customer — AEGIS" }] }),
  component: CustomerDetail,
});

interface Customer {
  id: string;
  email: string;
  token: string;
  created: string;
  subscriptions: Array<{ id: string; plan: string; status: SubStatus; period: string; last: string; next: string }>;
  txns: Array<{ plan: string; amount: string; status: SubStatus; ref: string; time: string }>;
}

const CUSTOMERS: Record<string, Customer> = {
  c1: {
    id: "c1", email: "adebayo@gmail.com", token: "nmb_tok_a91f4c72e5b8d0231aac", created: "Jun 01, 2026",
    subscriptions: [
      { id: "sub_01", plan: "Premium", status: "ACTIVE", period: "Jun 01 → Jul 01", last: "Jun 01, 2026", next: "Jul 01, 2026" },
      { id: "sub_02", plan: "Starter", status: "ACTIVE", period: "Jun 14 → Jul 14", last: "Jun 14, 2026", next: "Jul 14, 2026" },
    ],
    txns: [
      { plan: "Premium", amount: "₦5,000", status: "ACTIVE", ref: "nmb_7d3f...9a21", time: "Jun 01, 09:14am" },
      { plan: "Starter", amount: "₦1,500", status: "ACTIVE", ref: "nmb_9e88...02cd", time: "Jun 14, 08:02am" },
    ],
  },
  c2: {
    id: "c2", email: "chioma@techcorp.ng", token: "nmb_tok_8f3d2a19c74b6501e0f2", created: "May 22, 2026",
    subscriptions: [
      { id: "sub_02", plan: "Enterprise", status: "TRIALING", period: "Jun 24 → Jul 08", last: "—", next: "Jul 08, 2026" },
    ],
    txns: [{ plan: "Enterprise", amount: "₦0", status: "TRIALING", ref: "nmb_trial_...ffff", time: "Jun 24, 10:00am" }],
  },
  c3: {
    id: "c3", email: "emeka@startup.io", token: "nmb_tok_2b7ce43910af8802d1cc", created: "May 18, 2026",
    subscriptions: [],
    txns: [],
  },
  c4: {
    id: "c4", email: "funke@media.ng", token: "nmb_tok_6d0e19b3ac724408f9aa", created: "May 05, 2026",
    subscriptions: [{ id: "sub_04", plan: "Premium", status: "SUSPENDED", period: "May 05 → Jun 05", last: "May 05, 2026", next: "—" }],
    txns: [{ plan: "Premium", amount: "₦5,000", status: "SUSPENDED", ref: "nmb_2c1a...44b8", time: "May 05, 2026" }],
  },
  c5: {
    id: "c5", email: "tunde@saas.com", token: "nmb_tok_5147ea3b98d060c2ff11", created: "Apr 12, 2026",
    subscriptions: [
      { id: "sub_05", plan: "Enterprise", status: "ACTIVE", period: "Jun 12 → Jul 12", last: "Jun 12, 2026", next: "Jul 12, 2026" },
      { id: "sub_06", plan: "Premium", status: "ACTIVE", period: "Jun 05 → Jul 05", last: "Jun 05, 2026", next: "Jul 05, 2026" },
      { id: "sub_07", plan: "Starter", status: "ACTIVE", period: "Jun 01 → Jul 01", last: "Jun 01, 2026", next: "Jul 01, 2026" },
    ],
    txns: [
      { plan: "Enterprise", amount: "₦25,000", status: "ACTIVE", ref: "nmb_aa11...bb22", time: "Jun 12, 2026" },
      { plan: "Premium", amount: "₦5,000", status: "ACTIVE", ref: "nmb_cc33...dd44", time: "Jun 05, 2026" },
    ],
  },
  c6: {
    id: "c6", email: "ngozi@fintech.ng", token: "nmb_tok_ab73e28d0c916f45b332", created: "Apr 03, 2026",
    subscriptions: [{ id: "sub_06", plan: "Starter", status: "ACTIVE", period: "Jun 14 → Jul 14", last: "Jun 14, 2026", next: "Jul 14, 2026" }],
    txns: [{ plan: "Starter", amount: "₦1,500", status: "ACTIVE", ref: "nmb_ee55...ff66", time: "Jun 14, 2026" }],
  },
};

function CustomerDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { tokens, mode } = useTheme();
  const [copied, setCopied] = useState(false);
  const customer = CUSTOMERS[id] ?? {
    id, email: `${id}@example.com`, token: `nmb_tok_${id}00000000000000000000`, created: "Jun 01, 2026",
    subscriptions: [], txns: [],
  };

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg, border: tokens.cardBorder, boxShadow: tokens.cardShadow,
    borderRadius: 12, padding: 20,
  };
  const mono: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
  const label = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: tokens.accent, marginBottom: 12 }}>
      {text}
    </div>
  );

  const copyToken = () => {
    navigator.clipboard.writeText(customer.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tableWrap: React.CSSProperties = { ...cardStyle, padding: 0, overflow: "hidden" };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: tokens.muted, fontWeight: 500 };

  return (
    <AppShell title={customer.email} eyebrow="Customer Detail">
      <div style={{ marginTop: -24, marginBottom: 24 }}>
        <Link to="/customers" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: tokens.accent, fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Back to Customers
        </Link>
      </div>

      <div style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Email</div>
            <div style={{ color: tokens.text, fontSize: 14 }}>{customer.email}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Nomba Token</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.03)", border: `1px solid ${tokens.divider}`, borderRadius: 8, padding: "10px 14px" }}>
              <span style={{ ...mono, color: tokens.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{customer.token}</span>
              <button onClick={copyToken} style={{ background: "transparent", border: "none", color: copied ? "#22C55E" : tokens.muted, cursor: "pointer", display: "flex" }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Created</div>
              <div style={{ color: tokens.text, fontSize: 13 }}>{customer.created}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Metadata</div>
              <div style={{ ...mono, color: tokens.muted }}>{`{ source: "web", ref: "${customer.id}" }`}</div>
            </div>
          </div>
        </div>
      </div>

      <section style={{ marginBottom: 32 }}>
        {label("Subscriptions")}
        {customer.subscriptions.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", color: tokens.muted, padding: 40 }}>No subscriptions for this customer</div>
        ) : (
          <div style={tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                  {["Plan", "Status", "Current Period", "Last Charged", "Next Charge"].map((h) => (<th key={h} style={th}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {customer.subscriptions.map((s, i) => (
                  <tr key={s.id + i}
                    onClick={() => navigate({ to: "/subscriptions/$id", params: { id: s.id } })}
                    style={{ borderBottom: i === customer.subscriptions.length - 1 ? "none" : `1px solid ${tokens.divider}`, cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{s.plan}</td>
                    <td style={{ padding: "14px 16px" }}><StatusBadge status={s.status} /></td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{s.period}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{s.last}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{s.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        {label("Transaction History")}
        {customer.txns.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", color: tokens.muted, padding: 40 }}>No transactions for this customer</div>
        ) : (
          <div style={tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                  {["Plan", "Amount", "Status", "Nomba Reference", "Time"].map((h) => (<th key={h} style={th}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {customer.txns.map((t, i) => (
                  <tr key={i} style={{ borderBottom: i === customer.txns.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{t.plan}</td>
                    <td style={{ padding: "14px 16px", color: tokens.text }}>{t.amount}</td>
                    <td style={{ padding: "14px 16px" }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: "14px 16px", ...mono, color: tokens.muted }}>{t.ref}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{t.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

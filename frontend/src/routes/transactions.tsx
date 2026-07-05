import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Transactions — AEGIS" }] }),
  component: TransactionsRoute,
});

type TxStatus = "succeeded" | "failed" | "recovered";

interface Tx {
  id: string;
  customer: string;
  plan: string;
  amount: number;
  status: TxStatus;
  reference: string;
  response: string;
  time: string;
}

const ROWS: Tx[] = [
  { id: "t1", customer: "adebayo@gmail.com", plan: "Premium", amount: 5000, status: "succeeded", reference: "nmb_ref_9a72cf130b4e28d5", response: "Approved by issuer", time: "Jun 30, 2026 14:22" },
  { id: "t2", customer: "chioma@techcorp.ng", plan: "Enterprise", amount: 15000, status: "succeeded", reference: "nmb_ref_b18d0472ea5c9f10", response: "Approved by issuer", time: "Jun 30, 2026 12:04" },
  { id: "t3", customer: "emeka@startup.io", plan: "Starter", amount: 2000, status: "failed", reference: "nmb_ref_44a10ebc21f38dd7", response: "Insufficient funds", time: "Jun 30, 2026 09:41" },
  { id: "t4", customer: "funke@media.ng", plan: "Premium", amount: 5000, status: "recovered", reference: "nmb_ref_c092d5187b3eaa64", response: "Recovered after 2 retries", time: "Jun 29, 2026 22:15" },
  { id: "t5", customer: "tunde@saas.com", plan: "Enterprise", amount: 15000, status: "succeeded", reference: "nmb_ref_71ed6a084c5f2210", response: "Approved by issuer", time: "Jun 29, 2026 18:03" },
  { id: "t6", customer: "ngozi@fintech.ng", plan: "Starter", amount: 2000, status: "succeeded", reference: "nmb_ref_58fa30bc179ed442", response: "Approved by issuer", time: "Jun 29, 2026 10:27" },
  { id: "t7", customer: "kelechi@retail.ng", plan: "Premium", amount: 5000, status: "failed", reference: "nmb_ref_e2c194ab7f60d331", response: "Card declined by issuer", time: "Jun 28, 2026 20:11" },
  { id: "t8", customer: "yemi@logistics.io", plan: "Enterprise", amount: 15000, status: "recovered", reference: "nmb_ref_3dfe2081ac97b4c5", response: "Recovered after 1 retry", time: "Jun 28, 2026 15:48" },
];

const STATUS_COLOR: Record<TxStatus, string> = {
  succeeded: "#22C55E",
  failed: "#EF4444",
  recovered: "#94A3B8",
};

function TxBadge({ status }: { status: TxStatus }) {
  const color = STATUS_COLOR[status];
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
      {status}
    </span>
  );
}

function TransactionsRoute() {
  const { tokens, mode } = useTheme();
  const [status, setStatus] = useState<string>("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";

  const filtered = useMemo(
    () =>
      ROWS.filter(
        (r) =>
          (status === "All" || r.status === status.toLowerCase()) &&
          (query === "" || r.reference.includes(query.toLowerCase())),
      ),
    [status, query],
  );

  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${tokens.divider}`,
    borderRadius: 10,
    padding: "10px 14px",
    color: tokens.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <AppShell title="Transactions" eyebrow="Transaction Log">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
          {["All", "Succeeded", "Failed", "Recovered"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          <span style={{ color: tokens.muted, fontSize: 12 }}>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginLeft: "auto", position: "relative", minWidth: 280 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tokens.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Nomba reference..."
            style={{ ...inputStyle, width: "100%", paddingLeft: 34 }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "80px 24px", textAlign: "center", border: `1px dashed ${tokens.divider}`, borderRadius: 16 }}>
          <div className="font-display" style={{ fontSize: 18, color: tokens.text }}>No transactions yet</div>
        </div>
      ) : (
        <div
          style={{
            background: tokens.cardBg,
            border: tokens.cardBorder,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: tokens.cardShadow,
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                  {["Customer", "Plan", "Amount", "Status", "Nomba Ref", "Gateway Response", "Time"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 20px", fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: tokens.muted, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.divider}` : "none",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "16px 20px", color: tokens.text, whiteSpace: "nowrap" }}>{r.customer}</td>
                    <td style={{ padding: "16px 20px", color: tokens.muted }}>{r.plan}</td>
                    <td style={{ padding: "16px 20px", color: tokens.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      ₦{r.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "16px 20px" }}><TxBadge status={r.status} /></td>
                    <td style={{ padding: "16px 20px", color: tokens.muted, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, whiteSpace: "nowrap" }}>
                      {r.reference.slice(0, 12)}…
                    </td>
                    <td style={{ padding: "16px 20px", color: tokens.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.response}
                    </td>
                    <td style={{ padding: "16px 20px", color: tokens.muted, whiteSpace: "nowrap" }}>{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

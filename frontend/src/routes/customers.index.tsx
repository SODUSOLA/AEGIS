import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Customers — AEGIS" }] }),
  component: CustomersRoute,
});

interface Customer {
  id: string;
  email: string;
  token: string;
  activeSubs: number;
  created: string;
}

const ROWS: Customer[] = [
  { id: "c1", email: "adebayo@gmail.com", token: "nmb_tok_a91f4c72e5b8d0231aac", activeSubs: 2, created: "Jun 01, 2026" },
  { id: "c2", email: "chioma@techcorp.ng", token: "nmb_tok_8f3d2a19c74b6501e0f2", activeSubs: 1, created: "May 22, 2026" },
  { id: "c3", email: "emeka@startup.io", token: "nmb_tok_2b7ce43910af8802d1cc", activeSubs: 0, created: "May 18, 2026" },
  { id: "c4", email: "funke@media.ng", token: "nmb_tok_6d0e19b3ac724408f9aa", activeSubs: 1, created: "May 05, 2026" },
  { id: "c5", email: "tunde@saas.com", token: "nmb_tok_5147ea3b98d060c2ff11", activeSubs: 3, created: "Apr 12, 2026" },
  { id: "c6", email: "ngozi@fintech.ng", token: "nmb_tok_ab73e28d0c916f45b332", activeSubs: 1, created: "Apr 03, 2026" },
];

function CustomersRoute() {
  const { tokens, mode } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";

  const filtered = useMemo(
    () => ROWS.filter((r) => query === "" || r.email.includes(query.toLowerCase())),
    [query],
  );

  return (
    <AppShell
      title="Customers"
      eyebrow="Customer Management"
      actions={
        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tokens.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email..."
            style={{ width: "100%", background: inputBg, border: `1px solid ${tokens.divider}`, borderRadius: 10, padding: "10px 14px 10px 34px", color: tokens.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
          />
        </div>
      }
    >
      {filtered.length === 0 ? (
        <div style={{ padding: "80px 24px", textAlign: "center", border: `1px dashed ${tokens.divider}`, borderRadius: 16 }}>
          <div className="font-display" style={{ fontSize: 18, color: tokens.text, marginBottom: 8 }}>No customers yet</div>
          <div style={{ fontSize: 13, color: tokens.muted }}>Customers are created automatically when a subscriber enrolls</div>
        </div>
      ) : (
        <div style={{ background: tokens.cardBg, border: tokens.cardBorder, borderRadius: 16, overflow: "hidden", boxShadow: tokens.cardShadow, backdropFilter: "blur(12px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                {["Email", "Nomba Token", "Active Subscriptions", "Created"].map((h) => (
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
                  onClick={() => navigate({ to: "/customers/$id", params: { id: r.id } })}
                  style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.divider}` : "none", cursor: "pointer", transition: "background 150ms ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "16px 20px", color: tokens.text }}>{r.email}</td>
                  <td style={{ padding: "16px 20px", color: tokens.muted, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{r.token.slice(0, 8)}…</td>
                  <td style={{ padding: "16px 20px", color: r.activeSubs > 0 ? "#22C55E" : tokens.muted, fontWeight: 600 }}>{r.activeSubs}</td>
                  <td style={{ padding: "16px 20px", color: tokens.muted }}>{r.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
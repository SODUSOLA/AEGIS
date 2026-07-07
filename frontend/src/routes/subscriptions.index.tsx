import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";
import { StatusBadge, type SubStatus } from "@/components/app/StatusBadge";
import { PulseScoreBadge } from "@/components/PulseScoreBadge";
import { EmptyState } from "@/components/EmptyState";
import { aegis, type Subscription } from "@/api/aegis";
import { usePolling } from "@/hooks/usePolling";

export const Route = createFileRoute("/subscriptions/")({
  head: () => ({ meta: [{ title: "Subscriptions — AEGIS" }] }),
  component: SubscriptionsRoute,
});

type SortField = "pulseScore" | "currentPeriodEnd" | "createdAt";

function SubscriptionsRoute() {
  const { tokens, mode } = useTheme();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("All");
  const [plan, setPlan] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetcher = useCallback(
    () => aegis.getSubscriptions({ status, plan, sortBy, sortDir, page, pageSize, search: query }),
    [status, plan, sortBy, sortDir, page, pageSize, query],
  );

  const { data, loading } = usePolling(fetcher, 30000);

  const subscriptions = data?.subscriptions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";

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

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const sortIndicator = (field: SortField) => {
    if (sortBy !== field) return null;
    return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <AppShell title="Subscriptions" eyebrow="Subscription Management">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={selectStyle}>
          {["All", "ACTIVE", "TRIALING", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"].map((s) => (
            <option key={s} value={s}>{s === "All" ? "All statuses" : s.replace("_", " ")}</option>
          ))}
        </select>
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} style={selectStyle}>
          {["All", "Starter", "Premium", "Enterprise"].map((p) => (
            <option key={p} value={p}>{p === "All" ? "All plans" : p}</option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", position: "relative", minWidth: 260 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tokens.muted }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search by customer email..."
            style={{ ...selectStyle, width: "100%", paddingLeft: 34 }}
          />
        </div>
      </div>

      {subscriptions.length === 0 && !loading ? (
        <EmptyState label="No subscriptions yet" />
      ) : (
        <>
          <div style={{ background: tokens.cardBg, border: tokens.cardBorder, borderRadius: 16, overflow: "hidden", boxShadow: tokens.cardShadow, backdropFilter: "blur(12px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                  {["Customer", "Plan", "Status", "Pulse Score", "Next Billing", "Retries"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "14px 20px",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: tokens.muted,
                      }}
                    >
                      {h === "Pulse Score" ? (
                        <button
                          onClick={() => handleSort("pulseScore")}
                          style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center" }}
                        >
                          Pulse Score <ArrowUpDown size={11} style={{ marginLeft: 3 }} />
                          {sortIndicator("pulseScore")}
                        </button>
                      ) : h === "Next Billing" ? (
                        <button
                          onClick={() => handleSort("currentPeriodEnd")}
                          style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center" }}
                        >
                          Next Billing <ArrowUpDown size={11} style={{ marginLeft: 3 }} />
                          {sortIndicator("currentPeriodEnd")}
                        </button>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((r, i) => {
                  const sortFields: SortField[] = ["pulseScore", "currentPeriodEnd", "createdAt"];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate({ to: "/subscriptions/$id", params: { id: r.id } })}
                      style={{
                        borderBottom: i < subscriptions.length - 1 ? `1px solid ${tokens.divider}` : "none",
                        cursor: "pointer",
                        transition: "background 150ms ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "16px 20px", color: tokens.text }}>{r.customer}</td>
                      <td style={{ padding: "16px 20px", color: tokens.muted }}>{r.plan}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <StatusBadge status={r.status as SubStatus} />
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <PulseScoreBadge score={r.pulseScore} />
                      </td>
                      <td style={{ padding: "16px 20px", color: tokens.text, fontVariantNumeric: "tabular-nums" }}>
                        {r.nextCharge}
                      </td>
                      <td style={{ padding: "16px 20px", color: tokens.muted }}>
                        {r.retryCount}/{r.maxRetries}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 24,
                fontSize: 13,
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  background: "transparent",
                  border: `1px solid ${tokens.divider}`,
                  color: page <= 1 ? tokens.muted : tokens.text,
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >
                Previous
              </button>
              <span style={{ color: tokens.muted }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  background: "transparent",
                  border: `1px solid ${tokens.divider}`,
                  color: page >= totalPages ? tokens.muted : tokens.text,
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

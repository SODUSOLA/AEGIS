import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { StatusBadge, STATUS_COLORS, type SubStatus } from "@/components/app/StatusBadge";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/subscriptions/$id")({
  head: () => ({ meta: [{ title: "Subscription — AEGIS" }] }),
  component: SubscriptionDetail,
});

interface TimelineEntry {
  state: SubStatus;
  time: string;
  trigger: string;
}

const TIMELINE: TimelineEntry[] = [
  { state: "ACTIVE", time: "Today, 09:14am", trigger: "charge.recovered" },
  { state: "PAST_DUE", time: "Yesterday, 11:32pm", trigger: "charge.failed" },
  { state: "ACTIVE", time: "June 1, 2026", trigger: "charge.succeeded" },
  { state: "TRIALING", time: "May 25, 2026", trigger: "subscription created" },
];

const BILLING = [
  { amount: "₦5,000", status: "ACTIVE" as SubStatus, ref: "nmb_7d3f...9a21", resp: "Approved", time: "Today, 09:14am" },
  { amount: "₦5,000", status: "PAST_DUE" as SubStatus, ref: "nmb_2c1a...44b8", resp: "Insufficient Funds", time: "Yesterday, 11:32pm" },
  { amount: "₦5,000", status: "ACTIVE" as SubStatus, ref: "nmb_9e88...02cd", resp: "Approved", time: "June 1, 2026" },
  { amount: "₦0", status: "TRIALING" as SubStatus, ref: "nmb_trial_...ffff", resp: "Trial started", time: "May 25, 2026" },
];

const WEBHOOKS = [
  { type: "subscription.state_changed", delivery: "delivered", time: "Today, 09:14am", attempts: 1 },
  { type: "charge.recovered", delivery: "delivered", time: "Today, 09:14am", attempts: 2 },
  { type: "charge.failed", delivery: "retrying", time: "Yesterday, 11:32pm", attempts: 3 },
];

const SUBS: Record<string, { customer: string; customerId: string; plan: string; amount: string; period: string; status: SubStatus }> = {
  sub_01: { customer: "adebayo@gmail.com", customerId: "c1", plan: "Premium", amount: "₦5,000", period: "Jun 01, 2026 → Jul 01, 2026", status: "ACTIVE" },
  sub_02: { customer: "chioma@techcorp.ng", customerId: "c2", plan: "Enterprise", amount: "₦25,000", period: "Jun 24, 2026 → Jul 08, 2026", status: "TRIALING" },
  sub_03: { customer: "emeka@startup.io", customerId: "c3", plan: "Starter", amount: "₦1,500", period: "May 18, 2026 → Jun 18, 2026", status: "PAST_DUE" },
  sub_04: { customer: "funke@media.ng", customerId: "c4", plan: "Premium", amount: "₦5,000", period: "May 05, 2026 → Jun 05, 2026", status: "SUSPENDED" },
  sub_05: { customer: "tunde@saas.com", customerId: "c5", plan: "Enterprise", amount: "₦25,000", period: "Apr 12, 2026 → May 12, 2026", status: "CANCELLED" },
  sub_06: { customer: "ngozi@fintech.ng", customerId: "c6", plan: "Starter", amount: "₦1,500", period: "Jun 14, 2026 → Jul 14, 2026", status: "ACTIVE" },
};

function SubscriptionDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { tokens, mode } = useTheme();
  const [confirm, setConfirm] = useState<null | { action: "reactivate" | "suspend" | "cancel" }>(null);

  const sub = SUBS[id] ?? { customer: "unknown@example.com", customerId: "c1", plan: "Premium", amount: "₦5,000", period: "Jun 01, 2026 → Jul 01, 2026", status: "ACTIVE" as SubStatus };
  const currentStatus: SubStatus = sub.status;
  const showDunning = currentStatus === "PAST_DUE" || currentStatus === "SUSPENDED";


  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    boxShadow: tokens.cardShadow,
    borderRadius: 12,
    padding: 20,
  };

  const label = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: tokens.accent, marginBottom: 12 }}>
      {text}
    </div>
  );

  const mono: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
  const timelineLine = mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  return (
    <AppShell title={id} eyebrow="Subscription Detail">
      <div style={{ marginTop: -24, marginBottom: 24 }}>
        <Link
          to="/subscriptions"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: tokens.accent, fontSize: 13, textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Back to Subscriptions
        </Link>
      </div>

      {/* Top row 3 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 12, letterSpacing: "0.08em" }}>Current State</div>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
            <div style={{ transform: "scale(1.4)" }}>
              <StatusBadge status={currentStatus} />
            </div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 12, letterSpacing: "0.08em" }}>Plan</div>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: tokens.text }}>{sub.plan}</div>
          <div style={{ color: tokens.muted, fontSize: 13, marginTop: 4 }}>{sub.amount} / month</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 12, letterSpacing: "0.08em" }}>Billing Period</div>
          <div style={{ color: tokens.text, fontSize: 14 }}>{sub.period}</div>
        </div>
      </div>

      {/* State history */}

      {/* State history */}
      <section style={{ marginBottom: 32 }}>
        {label("State History")}
        <div style={{ ...cardStyle, padding: 24 }}>
          {TIMELINE.map((e, i) => {
            const color = STATUS_COLORS[e.state];
            const isLast = i === TIMELINE.length - 1;
            return (
              <div key={i} style={{ display: "flex", gap: 16, position: "relative", paddingBottom: isLast ? 0 : 20 }}>
                <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}66`, flexShrink: 0 }} />
                  {!isLast && <div style={{ flex: 1, width: 1, background: timelineLine, marginTop: 4 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: tokens.text, letterSpacing: "0.06em" }}>
                    {e.state.replace("_", " ")}
                  </div>
                  <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>{e.time}</div>
                  <div style={{ fontSize: 12, color: tokens.muted, fontStyle: "italic", marginTop: 2 }}>Triggered by: {e.trigger}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Customer + Plan */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <section>
          {label("Customer")}
          <div style={cardStyle}>
            <div style={{ color: tokens.text, fontSize: 14, marginBottom: 8 }}>{sub.customer}</div>
            <div style={{ ...mono, color: tokens.muted, marginBottom: 16 }}>nmb_cust_...{sub.customerId}</div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => navigate({ to: "/customers/$id", params: { id: sub.customerId } })}
                style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "8px 16px", borderRadius: 9999, fontSize: 12, cursor: "pointer" }}
              >
                View Customer
              </button>
            </div>
          </div>
        </section>

        <section>
          {label("Plan")}
          <div style={cardStyle}>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: tokens.text }}>Premium</div>
            <div style={{ color: tokens.muted, fontSize: 13, marginTop: 4 }}>₦5,000 / month</div>
            <div style={{ color: tokens.muted, fontSize: 12, marginTop: 12 }}>Plan changed on June 15, 2026</div>
          </div>
          <div style={{ marginTop: 16 }}>
            {label("Proration Applied")}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={{ ...mono, color: tokens.muted }}>(₦5,000 - ₦2,000) × 18/30 = ₦1,800 charged</div>
            </div>
          </div>
        </section>
      </div>

      {/* Billing history table */}
      <section style={{ marginBottom: 32 }}>
        {label("Billing History")}
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                {["Amount", "Status", "Nomba Reference", "Gateway Response", "Time"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: tokens.muted, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BILLING.map((row, i) => (
                <tr key={i} style={{ borderBottom: i === BILLING.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
                  <td style={{ padding: "14px 16px", color: tokens.text }}>{row.amount}</td>
                  <td style={{ padding: "14px 16px" }}><StatusBadge status={row.status} /></td>
                  <td style={{ padding: "14px 16px", ...mono, color: tokens.muted }}>{row.ref}</td>
                  <td style={{ padding: "14px 16px", color: tokens.muted }}>{row.resp}</td>
                  <td style={{ padding: "14px 16px", color: tokens.muted }}>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dunning (conditional) */}
      {showDunning && (
        <section style={{ marginBottom: 32 }}>
          {label("Dunning Status")}
          <div style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 16 }}>
              <div><div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Failure Reason</div><div style={{ color: tokens.text }}>Insufficient Funds</div></div>
              <div><div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Retry Attempt</div><div style={{ color: tokens.text }}>Attempt 2 of 3</div></div>
              <div><div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Last Attempted</div><div style={{ color: tokens.text }}>Yesterday, 11:32pm</div></div>
              <div><div style={{ fontSize: 11, color: tokens.muted, marginBottom: 4 }}>Next Retry</div><div style={{ color: tokens.text }}>Tomorrow, 09:00am</div></div>
            </div>
            <div style={{ height: 6, background: tokens.divider, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: "66%", height: "100%", background: "#EAB308" }} />
            </div>
          </div>
        </section>
      )}

      {/* Webhook events */}
      <section style={{ marginBottom: 32 }}>
        {label("Webhook Events")}
        <div style={cardStyle}>
          {WEBHOOKS.map((w, i) => {
            const color = w.delivery === "delivered" ? "#22C55E" : w.delivery === "failed" ? "#EF4444" : "#EAB308";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", borderBottom: i === WEBHOOKS.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
                <span style={{ ...mono, fontSize: 11, color: tokens.accent, padding: "4px 10px", borderRadius: 9999, background: mode === "dark" ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.15)" }}>{w.type}</span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color, padding: "3px 10px", borderRadius: 9999, background: `${color}1F` }}>{w.delivery}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: tokens.muted }}>{w.time}</span>
                <span style={{ fontSize: 11, color: tokens.muted }}>{w.attempts} attempts</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <section>
        {label("Actions")}
        <div style={{ display: "flex", gap: 12 }}>
          {(currentStatus === "SUSPENDED" || currentStatus === "PAST_DUE") && (
            <ActionButton color="#22C55E" onClick={() => setConfirm({ action: "reactivate" })} tokens={tokens}>Reactivate</ActionButton>
          )}
          {currentStatus === "ACTIVE" && (
            <ActionButton color="#F97316" onClick={() => setConfirm({ action: "suspend" })} tokens={tokens}>Suspend</ActionButton>
          )}
          {(currentStatus as SubStatus) !== "CANCELLED" && (
            <ActionButton color="#EF4444" onClick={() => setConfirm({ action: "cancel" })} tokens={tokens}>Cancel Subscription</ActionButton>
          )}
        </div>
      </section>

      {confirm && (
        <ConfirmModal
          action={confirm.action}
          onClose={() => setConfirm(null)}
          tokens={tokens}
        />
      )}
    </AppShell>
  );
}

function ActionButton({ color, onClick, children, tokens }: { color: string; onClick: () => void; children: React.ReactNode; tokens: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: `1px solid ${color}55`,
        color,
        padding: "10px 20px",
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${color}12`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function ConfirmModal({ action, onClose, tokens }: { action: "reactivate" | "suspend" | "cancel"; onClose: () => void; tokens: any }) {
  const map = {
    reactivate: { heading: "Reactivate this subscription?", color: "#22C55E", label: "Reactivate" },
    suspend: { heading: "Suspend this subscription?", color: "#F97316", label: "Suspend" },
    cancel: { heading: "Cancel this subscription?", color: "#EF4444", label: "Confirm" },
  }[action];
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: tokens.surface, border: tokens.cardBorder, borderRadius: 16, padding: 28, maxWidth: 420, width: "90%" }}
      >
        <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: tokens.text, margin: 0 }}>{map.heading}</h3>
        <p style={{ color: tokens.muted, fontSize: 13, marginTop: 8 }}>This action cannot be undone.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "10px 20px", borderRadius: 9999, fontSize: 13, cursor: "pointer" }}>Never mind</button>
          <button onClick={onClose} style={{ background: map.color, border: "none", color: "#0A0A0A", padding: "10px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{map.label}</button>
        </div>
      </div>
    </div>
  );
}

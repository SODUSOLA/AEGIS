import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Moon, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { StatusBadge, type SubStatus } from "@/components/app/StatusBadge";

export const Route = createFileRoute("/portal")({
  head: () => ({ meta: [{ title: "Subscription Portal — AEGIS" }] }),
  component: PortalPage,
});

interface BillingRow {
  date: string;
  amount: string;
  status: SubStatus;
}

const BILLING: BillingRow[] = [
  { date: "Jun 01, 2026", amount: "₦5,000", status: "ACTIVE" },
  { date: "May 01, 2026", amount: "₦5,000", status: "ACTIVE" },
  { date: "Apr 01, 2026", amount: "₦5,000", status: "ACTIVE" },
  { date: "Mar 01, 2026", amount: "₦5,000", status: "ACTIVE" },
];

type Modal = null | "pause" | "cancel" | "payment";

function PortalPage() {
  const { tokens, mode, toggle } = useTheme();
  const [modal, setModal] = useState<Modal>(null);

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    boxShadow: tokens.cardShadow,
    borderRadius: 16,
    padding: 24,
    backdropFilter: "blur(12px)",
  };

  const ghostBtn: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: `1px solid ${tokens.divider}`,
    color: tokens.text,
    padding: "12px 20px",
    borderRadius: 9999,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: tokens.bg, color: tokens.text, padding: "24px 16px 64px" }}>
      {/* Theme toggle */}
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ marginBottom: 4, marginTop: 24 }}>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.18em", color: tokens.text }}>
            AEGIS
          </div>
          <div style={{ fontSize: 13, color: tokens.muted, marginTop: 4 }}>Subscription Portal</div>
        </div>

        {/* Active Plan */}
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: tokens.text, margin: 0 }}>Premium</h2>
              <div style={{ fontSize: 14, color: tokens.text, marginTop: 6 }}>
                ₦5,000 <span style={{ color: tokens.muted }}>/ month</span>
              </div>
            </div>
            <StatusBadge status="ACTIVE" />
          </div>
          <div style={{ fontSize: 12, color: tokens.muted, borderTop: `1px solid ${tokens.divider}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <div>Current period: Jun 01 → Jul 01, 2026</div>
            <div>Charges on Jul 01, 2026</div>
          </div>
        </section>

        {/* Actions */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={ghostBtn} onClick={() => setModal("pause")}>Pause Subscription</button>
          <button style={{ ...ghostBtn, borderColor: "rgba(239,68,68,0.4)", color: "#EF4444" }} onClick={() => setModal("cancel")}>Cancel Subscription</button>
          <button style={ghostBtn} onClick={() => setModal("payment")}>Update Payment Method</button>
        </section>

        {/* Billing History */}
        <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: tokens.accent }}>
              Billing History
            </div>
          </div>
          <div>
            {BILLING.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 24px",
                  borderTop: `1px solid ${tokens.divider}`,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, color: tokens.text }}>{r.date}</span>
                  <span style={{ fontSize: 12, color: tokens.muted }}>{r.amount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StatusBadge status={r.status} />
                  <button
                    onClick={() => toast.success("Receipt downloaded")}
                    style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "6px 14px", borderRadius: 9999, fontSize: 12, cursor: "pointer" }}
                  >
                    Receipt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {modal === "pause" && (
        <ConfirmModal
          tokens={tokens}
          heading="Pause Subscription?"
          subline="Your subscription will be paused. No charges will be made until you resume."
          confirmLabel="Pause"
          onClose={() => setModal(null)}
          onConfirm={() => { toast.success("Subscription paused"); setModal(null); }}
        />
      )}
      {modal === "cancel" && (
        <ConfirmModal
          tokens={tokens}
          heading="Cancel Subscription?"
          subline="You will lose access at the end of your current billing period on Jul 01, 2026. This cannot be undone."
          confirmLabel="Cancel Subscription"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => { toast.success("Subscription cancelled"); setModal(null); }}
        />
      )}
      {modal === "payment" && (
        <PaymentModal
          tokens={tokens}
          mode={mode}
          onClose={() => setModal(null)}
          onSubmit={() => { toast.success("Payment method updated"); setModal(null); }}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  tokens, heading, subline, confirmLabel, danger, onClose, onConfirm,
}: { tokens: any; heading: string; subline: string; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: tokens.surface, border: tokens.cardBorder, borderRadius: 16, padding: 28, maxWidth: 440, width: "90%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: tokens.text, margin: 0 }}>{heading}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: tokens.muted, cursor: "pointer" }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13, color: tokens.muted, lineHeight: 1.6, margin: "0 0 24px 0" }}>{subline}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "9px 20px", borderRadius: 9999, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ background: danger ? "#EF4444" : tokens.accent, border: "none", color: danger ? "#fff" : "#0A0A0A", padding: "9px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ tokens, mode, onClose, onSubmit }: { tokens: any; mode: string; onClose: () => void; onSubmit: () => void }) {
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";
  const inputStyle: React.CSSProperties = {
    width: "100%", background: inputBg, border: `1px solid ${tokens.divider}`, borderRadius: 10,
    padding: "10px 14px", color: tokens.text, fontSize: 13, outline: "none", fontFamily: "inherit",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: tokens.surface, border: tokens.cardBorder, borderRadius: 16, padding: 28, maxWidth: 440, width: "90%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: tokens.text, margin: 0 }}>Update Payment Method</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: tokens.muted, cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 6 }}>Card Number</div>
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="4242 4242 4242 4242" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 6 }}>Expiry</div>
              <input value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM / YY" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 6 }}>CVV</div>
              <input value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="123" style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: tokens.muted }}>Card details are tokenized securely by Nomba.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "9px 20px", borderRadius: 9999, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={onSubmit} style={{ background: tokens.accent, border: "none", color: "#0A0A0A", padding: "9px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

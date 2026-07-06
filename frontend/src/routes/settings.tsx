import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — AEGIS" }] }),
  component: SettingsPage,
});

const API_KEY = "ak_live_4f8e2c9b1d3a7f6e5c2b8a91d0e4f7c3";
const WEBHOOK_SECRET = "whs_9c8f7e6d5a4b3c2d1e0f8a7b6c5d4e3f";
const MERCHANT_ID = "mcht_01jxyz789";

type ConfirmKind = null | "api" | "webhook" | "delete";

function SettingsPage() {
  const { tokens, mode } = useTheme();
  const [businessName, setBusinessName] = useState("Lagos Coffee Co.");
  const [email, setEmail] = useState("admin@lagoscoffee.ng");
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";
  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    boxShadow: tokens.cardShadow,
    borderRadius: 16,
    padding: 24,
    backdropFilter: "blur(12px)",
  };
  const mono: React.CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    color: tokens.text,
  };
  const label = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: tokens.accent, marginBottom: 14 }}>
      {text}
    </div>
  );
  const secretRow = (value: string, copied: boolean, onCopy: () => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.03)", border: `1px solid ${tokens.divider}`, borderRadius: 10, padding: "12px 14px" }}>
      <span style={{ ...mono, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      <button
        onClick={onCopy}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${tokens.divider}`, color: copied ? "#22C55E" : tokens.text, padding: "6px 14px", borderRadius: 9999, fontSize: 12, cursor: "pointer" }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
  const dangerBtn = (text: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{ background: "transparent", border: `1px solid rgba(239,68,68,0.4)`, color: "#EF4444", padding: "8px 16px", borderRadius: 9999, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
    >
      {text}
    </button>
  );
  const primaryBtn = (text: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{ background: tokens.accent, border: "none", color: "#0A0A0A", padding: "9px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      {text}
    </button>
  );

  const maskedKey = API_KEY.slice(0, 12) + "•".repeat(16) + API_KEY.slice(-4);
  const maskedSecret = "whs_" + "•".repeat(16);

  const copyKey = () => {
    navigator.clipboard.writeText(API_KEY);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };
  const copySecret = () => {
    navigator.clipboard.writeText(WEBHOOK_SECRET);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <AppShell title="Settings" eyebrow="Account Settings">
      <div style={{ display: "grid", gap: 20, maxWidth: 780 }}>
        {/* API Key */}
        <section style={cardStyle}>
          {label("API Key")}
          {secretRow(maskedKey, copiedKey, copyKey)}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 12, color: tokens.muted }}>Last rotated: Never</span>
            {dangerBtn("Rotate Key", () => setConfirm("api"))}
          </div>
        </section>

        {/* Business Info */}
        <section style={cardStyle}>
          {label("Business Info")}
          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 6 }}>Business Name</div>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={{ width: "100%", background: inputBg, border: `1px solid ${tokens.divider}`, borderRadius: 10, padding: "10px 14px", color: tokens.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.muted, marginBottom: 6 }}>Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", background: inputBg, border: `1px solid ${tokens.divider}`, borderRadius: 10, padding: "10px 14px", color: tokens.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {primaryBtn("Save Changes", () => toast.success("Business info updated"))}
          </div>
        </section>

        {/* Webhook Secret */}
        <section style={cardStyle}>
          {label("Webhook Secret")}
          {secretRow(maskedSecret, copiedSecret, copySecret)}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 12, color: tokens.muted }}>Use this to verify outbound webhook payloads from AEGIS</span>
            {dangerBtn("Rotate Secret", () => setConfirm("webhook"))}
          </div>
        </section>

        {/* Account Status */}
        <section style={cardStyle}>
          {label("Account Status")}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <StatusBadge status="ACTIVE" />
              <span style={{ ...mono, color: tokens.muted }}>{MERCHANT_ID}</span>
              <span style={{ fontSize: 12, color: tokens.muted }}>Member since June 1, 2026</span>
            </div>
            {dangerBtn("Delete Account", () => setConfirm("delete"))}
          </div>
        </section>
      </div>

      {confirm === "api" && (
        <ConfirmModal
          tokens={tokens}
          heading="Rotate API Key?"
          subline="This will invalidate your current key immediately. Any active integrations will break until updated."
          confirmLabel="Rotate Key"
          onClose={() => setConfirm(null)}
          onConfirm={() => { toast.success("API key rotated"); setConfirm(null); }}
        />
      )}
      {confirm === "webhook" && (
        <ConfirmModal
          tokens={tokens}
          heading="Rotate Webhook Secret?"
          subline="This will invalidate your current signing secret. Update your endpoints immediately or webhook verification will fail."
          confirmLabel="Rotate Secret"
          onClose={() => setConfirm(null)}
          onConfirm={() => { toast.success("Webhook secret rotated"); setConfirm(null); }}
        />
      )}
      {confirm === "delete" && (
        <ConfirmModal
          tokens={tokens}
          heading="Delete your account?"
          subline="This is permanent. All plans, customers, subscriptions and data will be lost."
          confirmLabel="Delete Account"
          onClose={() => setConfirm(null)}
          onConfirm={() => { toast.success("Account scheduled for deletion"); setConfirm(null); }}
        />
      )}
    </AppShell>
  );
}

function ConfirmModal({
  tokens, heading, subline, confirmLabel, onClose, onConfirm,
}: { tokens: any; heading: string; subline: string; confirmLabel: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: tokens.surface, border: tokens.cardBorder, borderRadius: 16, padding: 28, maxWidth: 460, width: "90%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: tokens.text, margin: 0 }}>{heading}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: tokens.muted, cursor: "pointer" }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13, color: tokens.muted, lineHeight: 1.6, margin: "0 0 24px 0" }}>{subline}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "9px 20px", borderRadius: 9999, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ background: "#EF4444", border: "none", color: "#fff", padding: "9px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

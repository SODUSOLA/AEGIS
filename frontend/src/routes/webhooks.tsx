import { createFileRoute } from "@tanstack/react-router";
import { Fragment as FragmentRow } from "react";
import { useState } from "react";
import { Copy, Check, Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks — AEGIS" }] }),
  component: WebhooksPage,
});

const EVENT_TYPES = [
  "subscription.activated",
  "subscription.past_due",
  "subscription.suspended",
  "subscription.canceled",
  "charge.succeeded",
  "charge.failed",
  "charge.recovered",
  "dunning.started",
  "plan.changed",
];

type InboundStatus = "processed" | "duplicate" | "failed";
const INBOUND: Array<{ event: string; received: string; status: InboundStatus; sub: string }> = [
  { event: "charge.succeeded", received: "Today, 09:14am", status: "processed", sub: "sub_01...9a21" },
  { event: "charge.failed", received: "Yesterday, 11:32pm", status: "processed", sub: "sub_03...44b8" },
  { event: "subscription.activated", received: "Yesterday, 08:04pm", status: "processed", sub: "sub_02...02cd" },
  { event: "charge.succeeded", received: "Jun 28, 07:10am", status: "duplicate", sub: "sub_01...9a21" },
  { event: "charge.failed", received: "Jun 27, 06:22pm", status: "failed", sub: "sub_04...ff11" },
  { event: "subscription.past_due", received: "Jun 26, 11:00am", status: "processed", sub: "sub_03...44b8" },
];

type DeliveryStatus = "delivered" | "failed" | "retrying";
const DELIVERIES: Array<{ url: string; event: string; attempts: string; last: string; status: DeliveryStatus; payload: object }> = [
  { url: "https://api.acme.com/hooks/aegis", event: "charge.succeeded", attempts: "Immediate", last: "Today, 09:14am", status: "delivered", payload: { id: "evt_9a21", type: "charge.succeeded", amount: 5000, currency: "NGN" } },
  { url: "https://api.acme.com/hooks/aegis", event: "charge.failed", attempts: "Immediate → +5min → +30min", last: "Yesterday, 11:32pm", status: "retrying", payload: { id: "evt_44b8", type: "charge.failed", reason: "insufficient_funds" } },
  { url: "https://relay.techcorp.ng/aegis", event: "subscription.activated", attempts: "Immediate", last: "Yesterday, 08:04pm", status: "delivered", payload: { id: "evt_02cd", type: "subscription.activated", sub: "sub_02" } },
  { url: "https://relay.techcorp.ng/aegis", event: "dunning.started", attempts: "Immediate → +5min", last: "Jun 27, 06:22pm", status: "failed", payload: { id: "evt_ff11", type: "dunning.started", reason: "network_timeout" } },
  { url: "https://api.acme.com/hooks/aegis", event: "plan.changed", attempts: "Immediate", last: "Jun 26, 03:15pm", status: "delivered", payload: { id: "evt_c001", type: "plan.changed", from: "Starter", to: "Premium" } },
  { url: "https://api.acme.com/hooks/aegis", event: "charge.recovered", attempts: "Immediate → +5min → +30min", last: "Jun 25, 10:00am", status: "delivered", payload: { id: "evt_b002", type: "charge.recovered", amount: 5000 } },
];

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

function WebhooksPage() {
  const { tokens, mode } = useTheme();
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const [endpoints, setEndpoints] = useState<Endpoint[]>([
    { id: "ep_1", url: "https://api.acme.com/hooks/aegis", events: ["charge.succeeded", "charge.failed", "subscription.activated"], secret: "whsec_9c8f7e6d5a4b3c2d1e0f", active: true },
    { id: "ep_2", url: "https://relay.techcorp.ng/aegis", events: ["dunning.started", "subscription.suspended", "plan.changed"], secret: "whsec_aa11bb22cc33dd44ee55", active: false },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg, border: tokens.cardBorder, boxShadow: tokens.cardShadow,
    borderRadius: 12, padding: 20, backdropFilter: "blur(12px)",
  };
  const label = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: tokens.accent, marginBottom: 12 }}>
      {text}
    </div>
  );
  const mono: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: tokens.muted, fontWeight: 500 };

  const pill = (text: string, color = tokens.accent) => (
    <span style={{ ...mono, fontSize: 11, color, padding: "3px 10px", borderRadius: 9999, background: mode === "dark" ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.18)" }}>
      {text}
    </span>
  );
  const badge = (text: string, color: string) => (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color, padding: "3px 10px", borderRadius: 9999, background: `${color}1F` }}>
      {text}
    </span>
  );
  const inbColor = (s: InboundStatus) => (s === "processed" ? "#22C55E" : s === "duplicate" ? "#EAB308" : "#EF4444");
  const delColor = (s: DeliveryStatus) => (s === "delivered" ? "#22C55E" : s === "retrying" ? "#EAB308" : "#EF4444");

  const tabBtn = (id: "inbound" | "outbound", text: string) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          padding: "8px 20px", borderRadius: 9999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
          background: active ? tokens.accent : "transparent",
          color: active ? "#0A0A0A" : tokens.muted,
        }}
      >
        {text}
      </button>
    );
  };

  return (
    <AppShell title="Webhooks" eyebrow="Webhook Management">
      <div style={{ display: "flex", gap: 6, marginBottom: 28, padding: 4, background: tokens.cardBg, border: tokens.cardBorder, borderRadius: 9999, width: "fit-content" }}>
        {tabBtn("inbound", "Inbound")}
        {tabBtn("outbound", "Outbound")}
      </div>

      {tab === "inbound" && (
        <section>
          {label("Nomba → AEGIS")}
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                  {["Event Type", "Received At", "Processing Status", "Linked Subscription"].map((h) => (<th key={h} style={th}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {INBOUND.map((r, i) => (
                  <tr key={i} style={{ borderBottom: i === INBOUND.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
                    <td style={{ padding: "14px 16px" }}>{pill(r.event)}</td>
                    <td style={{ padding: "14px 16px", color: tokens.muted }}>{r.received}</td>
                    <td style={{ padding: "14px 16px" }}>{badge(r.status, inbColor(r.status))}</td>
                    <td style={{ padding: "14px 16px", ...mono, color: tokens.muted }}>{r.sub}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "outbound" && (
        <>
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              {label("Endpoints")}
              <button
                onClick={() => setShowModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: tokens.accent, color: "#0A0A0A", border: "none", padding: "8px 18px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <Plus size={14} /> Add Endpoint
              </button>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              {endpoints.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  onToggle={() => setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? { ...e, active: !e.active } : e)))}
                  cardStyle={cardStyle}
                  tokens={tokens}
                  mode={mode}
                  mono={mono}
                  pill={pill}
                />
              ))}
            </div>
          </section>

          <section>
            {label("Delivery Log")}
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                    <th style={{ ...th, width: 32 }} />
                    {["Endpoint URL", "Event Type", "Attempts", "Last Attempted", "Status"].map((h) => (<th key={h} style={th}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {DELIVERIES.map((r, i) => {
                    const open = expanded === i;
                    return (
                      <FragmentRow key={i}>
                        <tr onClick={() => setExpanded(open ? null : i)}
                          style={{ borderBottom: `1px solid ${tokens.divider}`, cursor: "pointer" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "14px 16px", color: tokens.muted }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                          <td style={{ padding: "14px 16px", color: tokens.text, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url}</td>
                          <td style={{ padding: "14px 16px" }}>{pill(r.event)}</td>
                          <td style={{ padding: "14px 16px", color: tokens.muted, ...mono }}>{r.attempts}</td>
                          <td style={{ padding: "14px 16px", color: tokens.muted }}>{r.last}</td>
                          <td style={{ padding: "14px 16px" }}>{badge(r.status, delColor(r.status))}</td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={6} style={{ padding: 0, background: mode === "dark" ? "#000" : "#0A0A0A" }}>
                              <pre style={{ ...mono, color: "#94A3B8", padding: 20, margin: 0, overflow: "auto" }}>
{JSON.stringify(r.payload, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {showModal && (
        <AddEndpointModal
          onClose={() => setShowModal(false)}
          onAdd={(url, events) => {
            setEndpoints((prev) => [...prev, { id: `ep_${prev.length + 1}`, url, events, secret: `whsec_${Math.random().toString(36).slice(2, 20)}`, active: true }]);
            setShowModal(false);
          }}
          tokens={tokens}
          mode={mode}
        />
      )}
    </AppShell>
  );
}

function EndpointCard({ endpoint, onToggle, cardStyle, tokens, mode, mono, pill }: any) {
  const [copied, setCopied] = useState(false);
  const masked = endpoint.secret.slice(0, 8) + "•".repeat(16) + endpoint.secret.slice(-4);
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <div style={{ color: tokens.text, fontSize: 14, wordBreak: "break-all" }}>{endpoint.url}</div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 11, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>{endpoint.active ? "Active" : "Inactive"}</span>
          <span
            onClick={onToggle}
            style={{ width: 36, height: 20, borderRadius: 9999, background: endpoint.active ? "#22C55E" : tokens.divider, position: "relative", transition: "background 150ms" }}
          >
            <span style={{ position: "absolute", top: 2, left: endpoint.active ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left 150ms" }} />
          </span>
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {endpoint.events.map((e: string) => <span key={e}>{pill(e)}</span>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.03)", border: `1px solid ${tokens.divider}`, borderRadius: 8, padding: "10px 14px" }}>
        <span style={{ ...mono, color: tokens.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{masked}</span>
        <button onClick={() => { navigator.clipboard.writeText(endpoint.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ background: "transparent", border: "none", color: copied ? "#22C55E" : tokens.muted, cursor: "pointer", display: "flex" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "4px 12px", borderRadius: 9999, fontSize: 11, cursor: "pointer" }}>
          Rotate
        </button>
      </div>
    </div>
  );
}

const EVENTS = EVENT_TYPES;

function AddEndpointModal({ onClose, onAdd, tokens, mode }: { onClose: () => void; onAdd: (url: string, events: string[]) => void; tokens: any; mode: string }) {
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";
  const toggle = (e: string) => setSelected((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: tokens.surface, border: tokens.cardBorder, borderRadius: 16, padding: 28, maxWidth: 520, width: "90%", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: tokens.text, margin: 0 }}>Add Endpoint</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: tokens.muted, cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>URL</div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.yoursite.com/webhooks" style={{ width: "100%", background: inputBg, border: `1px solid ${tokens.divider}`, borderRadius: 10, padding: "10px 14px", color: tokens.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Events</div>
          <div style={{ display: "grid", gap: 8 }}>
            {EVENTS.map((e) => (
              <label key={e} style={{ display: "flex", alignItems: "center", gap: 10, color: tokens.text, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={selected.includes(e)} onChange={() => toggle(e)} />
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{e}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${tokens.divider}`, color: tokens.text, padding: "10px 20px", borderRadius: 9999, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={() => url && selected.length && onAdd(url, selected)}
            style={{ background: tokens.accent, border: "none", color: "#0A0A0A", padding: "10px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: url && selected.length ? 1 : 0.5 }}
          >
            Add Endpoint
          </button>
        </div>
      </div>
    </div>
  );
}

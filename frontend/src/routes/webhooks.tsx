import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState, useCallback } from "react";
import { Copy, Check, Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";
import { aegis, type WebhookEndpoint, type WebhookDelivery } from "@/api/aegis";
import { usePolling } from "@/hooks/usePolling";

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
type DeliveryStatus = "delivered" | "failed" | "retrying";

function WebhooksPage() {
  const { tokens, mode } = useTheme();
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});

  const { data: endpoints, refresh } = usePolling<WebhookEndpoint[]>(() => aegis.getWebhookEndpoints(), 30000);
  const epList = endpoints ?? [];

  const handleToggle = useCallback(async (ep: WebhookEndpoint) => {
    await aegis.toggleWebhookEndpoint(ep.id, !ep.active);
    refresh();
  }, [refresh]);

  const handleExpand = useCallback(async (epId: string) => {
    if (expanded === epId) {
      setExpanded(null);
      return;
    }
    setExpanded(epId);
    if (!deliveries[epId]) {
      const data = await aegis.getWebhookDeliveries(epId);
      setDeliveries((prev) => ({ ...prev, [epId]: data }));
    }
  }, [expanded, deliveries]);

  const handleAddEndpoint = useCallback(async (url: string, events: string[]) => {
    await aegis.createWebhookEndpoint(url, events);
    refresh();
    setShowModal(false);
  }, [refresh]);

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
          <InboundTable tokens={tokens} cardStyle={cardStyle} th={th} pill={pill} badge={badge} inbColor={inbColor} mono={mono} />
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
              {epList.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  onToggle={() => handleToggle(ep)}
                  onExpand={() => handleExpand(ep.id)}
                  isExpanded={expanded === ep.id}
                  deliveries={deliveries[ep.id] ?? []}
                  cardStyle={cardStyle}
                  tokens={tokens}
                  mode={mode}
                  mono={mono}
                  pill={pill}
                  delColor={delColor}
                  badge={badge}
                  th={th}
                />
              ))}
            </div>
          </section>

          {epList.length === 0 && (
            <div style={{ padding: "80px 24px", textAlign: "center", border: `1px dashed ${tokens.divider}`, borderRadius: 16 }}>
              <div className="font-display" style={{ fontSize: 18, color: tokens.text, marginBottom: 8 }}>No endpoints configured</div>
              <div style={{ fontSize: 13, color: tokens.muted }}>Add an endpoint to receive webhooks from AEGIS</div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <AddEndpointModal
          onClose={() => setShowModal(false)}
          onAdd={handleAddEndpoint}
          tokens={tokens}
          mode={mode}
        />
      )}
    </AppShell>
  );
}

const INBOUND_DATA: Array<{ event: string; received: string; status: InboundStatus; sub: string }> = [
  { event: "charge.succeeded", received: "Today, 09:14am", status: "processed", sub: "sub_01...9a21" },
  { event: "charge.failed", received: "Yesterday, 11:32pm", status: "processed", sub: "sub_03...44b8" },
  { event: "subscription.activated", received: "Yesterday, 08:04pm", status: "processed", sub: "sub_02...02cd" },
  { event: "charge.succeeded", received: "Jun 28, 07:10am", status: "duplicate", sub: "sub_01...9a21" },
  { event: "charge.failed", received: "Jun 27, 06:22pm", status: "failed", sub: "sub_04...ff11" },
  { event: "subscription.past_due", received: "Jun 26, 11:00am", status: "processed", sub: "sub_03...44b8" },
];

function InboundTable({ tokens, cardStyle, th, pill, badge, inbColor, mono }: any) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
            {["Event Type", "Received At", "Processing Status", "Linked Subscription"].map((h) => (<th key={h} style={th}>{h}</th>))}
          </tr>
        </thead>
        <tbody>
          {INBOUND_DATA.map((r, i) => (
            <tr key={i} style={{ borderBottom: i === INBOUND_DATA.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
              <td style={{ padding: "14px 16px" }}>{pill(r.event)}</td>
              <td style={{ padding: "14px 16px", color: tokens.muted }}>{r.received}</td>
              <td style={{ padding: "14px 16px" }}>{badge(r.status, inbColor(r.status))}</td>
              <td style={{ padding: "14px 16px", ...mono, color: tokens.muted }}>{r.sub}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointCard({ endpoint, onToggle, onExpand, isExpanded, deliveries, cardStyle, tokens, mode, mono, pill, delColor, badge, th }: any) {
  const [copied, setCopied] = useState(false);
  const masked = endpoint.secret.slice(0, 8) + "\u2022".repeat(16) + endpoint.secret.slice(-4);
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

      {/* Expand/collapse deliveries */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={onExpand}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: tokens.accent, fontSize: 12, cursor: "pointer", padding: 0 }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {isExpanded ? "Hide deliveries" : "View deliveries"}
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 12 }}>
          {deliveries.length === 0 ? (
            <div style={{ fontSize: 12, color: tokens.muted, padding: "12px 0" }}>No deliveries yet</div>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden", background: mode === "dark" ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tokens.divider}` }}>
                    {["Event Type", "Attempts", "Last Attempted", "Status"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((del: any, i: number) => (
                    <tr key={del.id} style={{ borderBottom: i === deliveries.length - 1 ? "none" : `1px solid ${tokens.divider}` }}>
                      <td style={{ padding: "10px 16px" }}>{pill(del.event)}</td>
                      <td style={{ padding: "10px 16px", color: tokens.muted, ...mono }}>{del.attempts}</td>
                      <td style={{ padding: "10px 16px", color: tokens.muted }}>{del.lastAttempted}</td>
                      <td style={{ padding: "10px 16px" }}>{badge(del.status, delColor(del.status))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
            {EVENT_TYPES.map((e) => (
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

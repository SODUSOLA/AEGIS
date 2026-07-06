import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Plans — AEGIS" }] }),
  component: PlansRoute,
});

interface Plan {
  id: string;
  name: string;
  amount: number;
  interval: "Weekly" | "Monthly" | "Yearly" | "Custom";
  subscribers: number;
  created: string;
}

const SEED: Plan[] = [
  { id: "p1", name: "Starter", amount: 2000, interval: "Monthly", subscribers: 89, created: "Mar 12, 2026" },
  { id: "p2", name: "Premium", amount: 5000, interval: "Monthly", subscribers: 124, created: "Feb 04, 2026" },
  { id: "p3", name: "Enterprise", amount: 15000, interval: "Monthly", subscribers: 31, created: "Jan 22, 2026" },
];

function PillButton({
  children,
  onClick,
  variant = "solid",
  danger = false,
  type = "button",
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "ghost";
  danger?: boolean;
  type?: "button" | "submit";
  full?: boolean;
}) {
  const { tokens } = useTheme();
  const [hover, setHover] = useState(false);
  const solidBg = tokens.accent;
  const solidColor = "#0A0A0A";
  const ghostColor = danger && hover ? "#EF4444" : tokens.text;
  return (
    <button
      type={type}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "10px 20px",
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 150ms ease",
        width: full ? "100%" : undefined,
        background: variant === "solid" ? solidBg : "transparent",
        color: variant === "solid" ? solidColor : ghostColor,
        border: variant === "solid" ? "none" : `1px solid ${tokens.divider}`,
        opacity: variant === "solid" && hover ? 0.9 : 1,
      }}
    >
      {children}
    </button>
  );
}

function PlansRoute() {
  const { tokens, mode } = useTheme();
  const [plans] = useState<Plan[]>(SEED);
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      title="Plans"
      eyebrow="Plan Management"
      actions={<PillButton onClick={() => setOpen(true)}>+ Create Plan</PillButton>}
    >
      {plans.length === 0 ? (
        <EmptyState label="No plans yet" cta="Create your first plan" onClick={() => setOpen(true)} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {plans.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <PlanCard plan={p} />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && <CreatePlanModal onClose={() => setOpen(false)} mode={mode} tokens={tokens} />}
      </AnimatePresence>
    </AppShell>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const { tokens } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: tokens.cardBg,
        border: tokens.cardBorder,
        borderRadius: 16,
        padding: 24,
        backdropFilter: "blur(12px)",
        boxShadow: hover ? "0 0 24px rgba(148,163,184,0.12)" : tokens.cardShadow,
        transition: "box-shadow 220ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: tokens.text }}>
          {plan.name}
        </h3>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: tokens.accent,
            border: `1px solid ${tokens.divider}`,
            padding: "3px 10px",
            borderRadius: 9999,
          }}
        >
          {plan.interval}
        </span>
      </div>
      <div>
        <div className="font-display" style={{ fontSize: 32, fontWeight: 700, color: tokens.text, letterSpacing: "-0.02em" }}>
          ₦{plan.amount.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: tokens.muted, marginTop: 4 }}>per {plan.interval.toLowerCase()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: tokens.muted }}>
        <span>{plan.subscribers} subscribers</span>
        <span>Created {plan.created}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <PillButton variant="ghost">Edit</PillButton>
        <PillButton variant="ghost" danger>Archive</PillButton>
      </div>
    </div>
  );
}

function EmptyState({ label, sub, cta, onClick }: { label: string; sub?: string; cta?: string; onClick?: () => void }) {
  const { tokens } = useTheme();
  return (
    <div
      style={{
        padding: "80px 24px",
        textAlign: "center",
        border: `1px dashed ${tokens.divider}`,
        borderRadius: 16,
      }}
    >
      <div className="font-display" style={{ fontSize: 18, color: tokens.text, marginBottom: 8 }}>{label}</div>
      {sub && <div style={{ fontSize: 13, color: tokens.muted, marginBottom: 20 }}>{sub}</div>}
      {cta && (
        <div style={{ marginTop: 20, display: "inline-block" }}>
          <PillButton onClick={onClick}>{cta}</PillButton>
        </div>
      )}
    </div>
  );
}

function CreatePlanModal({
  onClose,
  mode,
  tokens,
}: {
  onClose: () => void;
  mode: "dark" | "light";
  tokens: ReturnType<typeof useTheme>["tokens"];
}) {
  const inputBg = mode === "dark" ? "#1A1A1A" : "#F8FAFC";
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [interval, setInterval] = useState("Monthly");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: tokens.surface,
          border: tokens.cardBorder,
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <h2 className="font-display" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: tokens.text, marginBottom: 20 }}>
          Create Plan
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onClose();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <Field label="Plan Name" tokens={tokens}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium"
              style={inputStyle(inputBg, tokens.text, tokens.divider)}
            />
          </Field>
          <Field label="Amount" tokens={tokens}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: tokens.muted, fontSize: 14 }}>₦</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                style={{ ...inputStyle(inputBg, tokens.text, tokens.divider), paddingLeft: 28 }}
              />
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Currency" tokens={tokens}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle(inputBg, tokens.text, tokens.divider)}>
                <option>NGN</option>
                <option>USD</option>
                <option>GHS</option>
                <option>KES</option>
              </select>
            </Field>
            <Field label="Billing Interval" tokens={tokens}>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} style={inputStyle(inputBg, tokens.text, tokens.divider)}>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Yearly</option>
                <option>Custom</option>
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <PillButton variant="ghost" onClick={onClose}>Cancel</PillButton>
            <PillButton type="submit">Create Plan</PillButton>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, tokens, children }: { label: string; tokens: ReturnType<typeof useTheme>["tokens"]; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: tokens.muted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    width: "100%",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: "12px 14px",
    color,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  };
}

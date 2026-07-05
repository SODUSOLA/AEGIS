import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Copy, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "You're in — AEGIS" }] }),
  component: OnboardingPage,
});

const API_KEY = "ak_live_4f8e2c9b7a1d3e5f6c8b9a2d4e7f1c3b";

function OnboardingPage() {
  const { mode, toggle } = useTheme();
  const dark = mode === "dark";
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const t = useMemo(
    () =>
      dark
        ? {
            bg: "#0A0A0A",
            surface: "#111111",
            text: "#FFFFFF",
            cardBg: "rgba(255,255,255,0.04)",
            cardBorder: "1px solid rgba(255,255,255,0.08)",
            cardShadow: "none",
            hoverGlow: "0 0 24px rgba(148,163,184,0.12)",
            ecg: "#94A3B8",
            ecgOpacity: 0.12,
            divider: "rgba(255,255,255,0.06)",
          }
        : {
            bg: "#FFFFFF",
            surface: "#F8FAFC",
            text: "#0A0A0A",
            cardBg: "#FFFFFF",
            cardBorder: "1px solid rgba(0,0,0,0.08)",
            cardShadow: "0 1px 4px rgba(0,0,0,0.08)",
            hoverGlow: "0 4px 16px rgba(0,0,0,0.08)",
            ecg: "#64748B",
            ecgOpacity: 0.25,
            divider: "rgba(0,0,0,0.06)",
          },
    [dark],
  );


  const masked = `${API_KEY.slice(0, 12)}••••••••••••••••••`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(API_KEY);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{ background: t.bg, color: t.text }}
    >
      <ECGBackdrop color={t.ecg} opacity={t.ecgOpacity} />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <span
          className="font-display text-base font-bold"
          style={{ letterSpacing: "0.2em" }}
        >
          AEGIS
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={{
            border: t.cardBorder,
            background: t.cardBg,
            color: "#94A3B8",
          }}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      {/* Content */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[560px] flex-col justify-center px-6 py-10">
        <div className="space-y-3">
          <span
            className="block text-[11px] font-medium uppercase"
            style={{ color: "#94A3B8", letterSpacing: "0.3em" }}
          >
            You're in
          </span>
          <h1 className="font-display text-4xl font-bold leading-[1.1] sm:text-5xl">
            Your account is ready.
          </h1>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            This is your API key. Copy it now — it won't be shown again.
          </p>
        </div>

        {/* API Key card */}
        <div
          className="mt-8 flex items-center justify-between gap-4 p-4 sm:p-5"
          style={{
            background: t.cardBg,
            border: t.cardBorder,
            borderRadius: 16,
            boxShadow: t.cardShadow,
            backdropFilter: dark ? "blur(12px)" : undefined,
          }}
        >
          <code
            className="truncate font-mono text-xs sm:text-sm"
            style={{ color: t.text }}
          >
            {masked}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all"
            style={{
              background: "#94A3B8",
              color: "#0A0A0A",
            }}
          >
            {copied ? (
              <>
                <Check size={14} /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-xs" style={{ color: "#6B7280" }}>
          Store this somewhere safe. You can rotate it later in Settings.
        </p>

        {/* Steps */}
        <div className="mt-10 space-y-3">
          <StepCard
            t={t}
            number="01"
            title="Copy your API key"
            description="Use it to authenticate all requests to AEGIS"
            onClick={handleCopy}
            done={copied}
          />
          <StepCard
            t={t}
            number="02"
            title="Create your first plan"
            description="Define your pricing, billing interval, and currency"
            onClick={() => navigate({ to: "/plans" })}
          />
          <StepCard
            t={t}
            number="03"
            title="Read the docs"
            description="Integrate AEGIS into your checkout flow"
            href="https://developer.nomba.com"
          />
        </div>

        {/* CTA */}
        <Link
          to="/dashboard"
          className="mt-10 inline-flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-all hover:shadow-[0_0_24px_rgba(148,163,184,0.25)]"
          style={{ background: "#94A3B8", color: "#0A0A0A" }}
        >
          Go to Dashboard
        </Link>
        <p className="mt-3 text-center text-xs" style={{ color: "#6B7280" }}>
          You can always find your API key under Settings
        </p>
      </main>
    </div>
  );
}

type Theme = {
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  hoverGlow: string;
  text: string;
};

function StepCard({
  t,
  number,
  title,
  description,
  onClick,
  href,
  done,
}: {
  t: Theme;
  number: string;
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  done?: boolean;
}) {
  const [hover, setHover] = useState(false);

  const inner = (
    <>
      <span
        className="font-display text-lg font-bold tabular-nums"
        style={{ color: "#94A3B8", minWidth: 28 }}
      >
        {number}
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold" style={{ color: t.text }}>
          {title}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: "#6B7280" }}>
          {description}
        </div>
      </div>
      <span style={{ color: "#94A3B8" }}>
        {done ? <Check size={16} /> : <ArrowRight size={16} />}
      </span>
    </>
  );

  const style: React.CSSProperties = {
    background: t.cardBg,
    border: t.cardBorder,
    borderRadius: 16,
    boxShadow: hover ? t.hoverGlow : t.cardShadow,
    transform: hover ? "translateY(-1px)" : "translateY(0)",
    transition: "all 220ms ease",
  };

  const className =
    "flex w-full items-center gap-4 p-4 sm:p-5 text-left cursor-pointer";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={style}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {inner}
    </button>
  );
}

function ECGBackdrop({ color, opacity }: { color: string; opacity: number }) {
  const segment = (xStart: number) => {
    const x = xStart;
    return [
      `M ${x} 100`,
      `L ${x + 60} 100`,
      `Q ${x + 70} 92, ${x + 80} 100`,
      `L ${x + 100} 100`,
      `L ${x + 108} 108`,
      `L ${x + 116} 50`,
      `L ${x + 124} 130`,
      `L ${x + 132} 100`,
      `Q ${x + 150} 85, ${x + 170} 100`,
      `L ${x + 240} 100`,
    ].join(" ");
  };
  const path = Array.from({ length: 8 }, (_, i) => segment(i * 240)).join(" ");
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute left-0 top-1/2 h-[260px] w-[200%] -translate-y-1/2 animate-[ecg-scroll-onb_28s_linear_infinite]"
        viewBox="0 0 1920 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <style>{`
        @keyframes ecg-scroll-onb {
          0% { transform: translate(0, -50%); }
          100% { transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
}

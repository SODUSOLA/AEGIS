import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AEGIS — Recurring Revenue, Handled." },
      {
        name: "description",
        content:
          "AEGIS is the subscription infrastructure layer Nigerian businesses have been missing. Built on Nomba.",
      },
    ],
  }),
  component: LandingPage,
});

/* ---------------- ECG WAVEFORM ---------------- */
function ECGWave() {
  // Build a long ECG path: long flat baseline, P bump, sharp QRS spike, T bump
  const segment = (xStart: number) => {
    const x = xStart;
    return [
      `M ${x} 100`,
      `L ${x + 60} 100`,
      // small P
      `Q ${x + 70} 92, ${x + 80} 100`,
      `L ${x + 100} 100`,
      // Q dip
      `L ${x + 108} 108`,
      // R sharp spike
      `L ${x + 116} 50`,
      // S dip
      `L ${x + 124} 130`,
      `L ${x + 132} 100`,
      // T wave
      `Q ${x + 150} 85, ${x + 170} 100`,
      `L ${x + 240} 100`,
    ].join(" ");
  };
  const path = [segment(0), segment(240), segment(480), segment(720), segment(960), segment(1200), segment(1440), segment(1680)].join(" ");

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute left-0 top-1/2 h-[260px] w-[200%] -translate-y-1/2 animate-[ecg-scroll_18s_linear_infinite]"
        viewBox="0 0 1920 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={path}
          fill="none"
          stroke="#94A3B8"
          strokeOpacity="0.15"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <style>{`
        @keyframes ecg-scroll {
          0% { transform: translate(0, -50%); }
          100% { transform: translate(-50%, -50%); }
        }
      `}</style>
      {/* bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
    </div>
  );
}

/* ---------------- NAVBAR ---------------- */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={
        scrolled
          ? {
              background: "rgba(10,10,10,0.8)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }
          : { background: "transparent" }
      }
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <a
          href="#top"
          className="font-display font-bold text-white"
          style={{ letterSpacing: "0.2em", fontSize: "1.05rem" }}
        >
          AEGIS
        </a>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost hidden sm:inline-flex">
            Login
          </Link>
          <Link to="/register" className="btn-primary">
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ---------------- HERO ---------------- */
function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        onDone?.();
      }
    }, 55);
    return () => clearInterval(id);
  }, [text, onDone]);
  return <span className="caret">{shown}</span>;
}

function Hero() {
  const [done, setDone] = useState(false);
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
    >
      <ECGWave />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display text-balance text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl"
        >
          <Typewriter text="Recurring Revenue, Handled." onDone={() => setDone(true)} />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: done ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-6 text-xs font-medium uppercase"
          style={{ color: "#94A3B8", letterSpacing: "0.3em", fontVariantCaps: "small-caps" }}
        >
          From Nomba
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: done ? 1 : 0, y: done ? 0 : 10 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mx-auto mt-8 max-w-2xl text-base leading-relaxed md:text-lg"
          style={{ color: "#9CA3AF" }}
        >
          AEGIS is the subscription infrastructure layer Nigerian businesses have been missing.
          Automated billing, intelligent retry, zero manual reconciliation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: done ? 1 : 0, y: done ? 0 : 10 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link to="/register" className="btn-primary">Start Building</Link>
          <a href="#architecture" className="btn-ghost">See How It Works</a>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------- SECTION HELPERS ---------------- */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <FadeUp>
        <p className="eyebrow">{eyebrow}</p>
      </FadeUp>
      <FadeUp delay={0.08}>
        <h2 className="font-display mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          {title}
        </h2>
      </FadeUp>
    </div>
  );
}

/* ---------------- PROBLEM ---------------- */
function Problem() {
  const flow = ["Failed Charge", "No Recovery", "State Confusion", "Manual Reconciliation"];
  const cards = [
    { t: "No Dunning Flows", d: "Automated recovery simply doesn't exist." },
    { t: "Inconsistent Webhooks", d: "Payment events arrive late or not at all." },
    { t: "No State Tracking", d: "Engineers rebuild subscription logic every time." },
    { t: "Engineering Waste", d: "Sprint cycles lost rebuilding billing from scratch." },
  ];
  return (
    <section className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-6xl">
        <SectionHeader eyebrow="The Problem" title="Nigerian recurring billing is broken." />

        {/* fractured flow */}
        <div className="mt-20 flex flex-col items-center gap-3 md:flex-row md:flex-wrap md:justify-center">
          {flow.map((node, i) => (
            <div key={node} className="flex items-center gap-3">
              <FadeUp delay={i * 0.08}>
                <div
                  className="rounded-full border px-5 py-2.5 text-sm text-white/90"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {node}
                </div>
              </FadeUp>
              {i < flow.length - 1 && (
                <FadeUp delay={i * 0.08 + 0.04}>
                  <div
                    className="hidden h-px w-12 md:block"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, rgba(148,163,184,0.4) 0 6px, transparent 6px 12px)",
                    }}
                  />
                  <div
                    className="block h-6 w-px md:hidden"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(180deg, rgba(148,163,184,0.4) 0 4px, transparent 4px 8px)",
                    }}
                  />
                </FadeUp>
              )}
            </div>
          ))}
        </div>

        <div className="mt-20 grid grid-cols-1 gap-5 md:grid-cols-2">
          {cards.map((c, i) => (
            <FadeUp key={c.t} delay={i * 0.1} className={i % 2 === 1 ? "md:mt-10" : ""}>
              <div className="glass-card glass-card-hover p-7">
                <h3 className="font-display text-xl font-semibold text-white">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#9CA3AF" }}>
                  {c.d}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- ARCHITECTURE ---------------- */
function Architecture() {
  const steps = [
    { n: "01", t: "Merchant App", d: "Your product sends API requests using your scoped AEGIS key." },
    { n: "02", t: "AEGIS API", d: "Authentication middleware resolves merchant identity on every request." },
    { n: "03", t: "State Machine", d: "Subscription lifecycle transitions automatically." },
    { n: "04", t: "Billing & Dunning Engine", d: "BullMQ schedules charges, retries, and recovery." },
    { n: "05", t: "Nomba API", d: "Tokenized charges, webhook ingestion, transaction verification." },
  ];
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 70%", "end 40%"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="architecture" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-5xl">
        <SectionHeader eyebrow="Architecture" title="Five layers. One reliable engine." />

        <div ref={containerRef} className="relative mt-20 pl-8 md:pl-16">
          {/* base line */}
          <div
            className="absolute left-3 top-0 h-full w-px md:left-7"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          {/* progress line */}
          <motion.div
            className="absolute left-3 top-0 w-px md:left-7"
            style={{ height: lineHeight, background: "#94A3B8" }}
          />

          <div className="space-y-10">
            {steps.map((s, i) => (
              <StepRow key={s.n} step={s} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepRow({ step, index }: { step: { n: string; t: string; d: string }; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30% 0px -30% 0px" });
  return (
    <div ref={ref} className="relative">
      {/* node dot */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={inView ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="absolute -left-[calc(2rem-0.4rem)] top-3 h-2.5 w-2.5 rounded-full md:-left-[calc(4rem-0.4rem)]"
        style={{
          background: inView ? "#94A3B8" : "#333",
          boxShadow: inView ? "0 0 16px rgba(148,163,184,0.5)" : "none",
        }}
      />
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="glass-card glass-card-hover p-6 md:p-8"
        style={
          inView
            ? { borderLeft: "2px solid #94A3B8", paddingLeft: "calc(2rem - 1px)" }
            : undefined
        }
      >
        <div className="flex items-baseline gap-4">
          <span
            className="font-display text-sm font-medium"
            style={{ color: "#94A3B8", letterSpacing: "0.15em" }}
          >
            {step.n}
          </span>
          <h3
            className="font-display text-lg font-semibold uppercase text-white md:text-xl"
            style={{ letterSpacing: "0.08em" }}
          >
            {step.t}
          </h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed md:text-base" style={{ color: "#9CA3AF" }}>
          {step.d}
        </p>
      </motion.div>
    </div>
  );
}

/* ---------------- FEATURES ---------------- */
function Icon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "#94A3B8",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<string, React.ReactNode> = {
    plan: <><rect x="4" y="5" width="16" height="15" rx="2" {...common} /><path d="M8 3v4M16 3v4M4 11h16" {...common} /></>,
    lifecycle: <><circle cx="12" cy="12" r="8" {...common} /><path d="M12 4v4l3 2" {...common} /></>,
    billing: <><rect x="3" y="6" width="18" height="13" rx="2" {...common} /><path d="M3 10h18M7 15h4" {...common} /></>,
    retry: <><path d="M20 12a8 8 0 1 1-3-6.2" {...common} /><path d="M20 4v5h-5" {...common} /></>,
    inbound: <><path d="M12 3v12M6 11l6 6 6-6M5 21h14" {...common} /></>,
    outbound: <><path d="M12 21V9M6 13l6-6 6 6M5 3h14" {...common} /></>,
    portal: <><rect x="3" y="4" width="18" height="14" rx="2" {...common} /><path d="M3 9h18M8 14h4" {...common} /></>,
    tenant: <><path d="M4 21V8l8-5 8 5v13" {...common} /><path d="M9 21v-6h6v6" {...common} /></>,
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Features() {
  const items = [
    { i: "plan", t: "Plan Management", d: "Flexible intervals, localized currency, merchant scoped." },
    { i: "lifecycle", t: "Subscription Lifecycle", d: "Six automated subscription states." },
    { i: "billing", t: "Billing Engine", d: "Cron scheduled tokenized billing via Nomba." },
    { i: "retry", t: "Dunning & Retry", d: "Three-step exponential retry strategy." },
    { i: "inbound", t: "Inbound Webhooks", d: "Idempotent webhook ingestion and deduplication." },
    { i: "outbound", t: "Outbound Webhooks", d: "HMAC-signed merchant event delivery." },
    { i: "portal", t: "Customer Portal", d: "Embeddable self-service subscription widget." },
    { i: "tenant", t: "Multi-Tenant Core", d: "Strict merchant-level data isolation." },
  ];
  return (
    <section className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Capabilities"
          title="Everything the billing layer needs."
        />
        <div className="mt-20 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <FadeUp key={it.t} delay={(i % 4) * 0.06}>
              <div className="glass-card glass-card-hover h-full p-6">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.12)" }}
                >
                  <Icon name={it.i} />
                </div>
                <h3 className="font-display mt-5 text-base font-semibold text-white">{it.t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#9CA3AF" }}>
                  {it.d}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- DEMO ---------------- */
function Demo() {
  const cards = [
    { n: "01", t: "Register", d: "Merchant receives scoped ak_live_… API key." },
    { n: "02", t: "Create Plan", d: "Premium plan configured at NGN 5,000/month." },
    { n: "03", t: "Customer Subscribes", d: "Checkout completed with tokenized card." },
    { n: "04", t: "Payment Succeeds", d: "State → ACTIVE. subscription.activated fired." },
    { n: "05", t: "Renewal Fails", d: "Insufficient funds." },
    { n: "06", t: "Dunning Starts", d: "State → PAST_DUE. subscription.past_due fired." },
    { n: "07", t: "Retry", d: "Scheduler retries payment." },
    { n: "08", t: "Recovery", d: "State → ACTIVE. charge.recovered fired. Dashboard updates instantly." },
    { n: "09", t: "Plan Upgrade", d: "Mid-cycle proration calculated automatically." },
  ];

  return (
    <section className="relative py-32 md:py-40">
      <div className="px-6">
        <SectionHeader
          eyebrow="Demo"
          title="From subscribe to recovered — watch the engine work."
        />
      </div>

      {/* Desktop: horizontal scroll. Mobile: vertical stack */}
      <div className="mt-20">
        <div className="hidden md:block">
          <div className="scrollbar-hide overflow-x-auto px-[10vw] pb-6">
            <div className="flex gap-5">
              {cards.map((c, i) => (
                <DemoCard key={c.n} card={c} index={i} horizontal />
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 md:hidden">
          {cards.map((c, i) => (
            <DemoCard key={c.n} card={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoCard({
  card,
  index,
  horizontal = false,
}: {
  card: { n: string; t: string; d: string };
  index: number;
  horizontal?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: (index % 5) * 0.08 }}
      className={`glass-card glass-card-hover group p-6 ${
        horizontal ? "w-[280px] shrink-0" : ""
      }`}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: inView
          ? "0 0 20px rgba(0,0,0,0.4), 0 0 24px rgba(148,163,184,0.08)"
          : "0 0 20px rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="font-display text-xs font-medium"
        style={{ color: "#94A3B8", letterSpacing: "0.2em" }}
      >
        STEP {card.n}
      </div>
      <h3 className="font-display mt-3 text-lg font-semibold text-white">{card.t}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "#9CA3AF" }}>
        {card.d}
      </p>
    </motion.div>
  );
}

/* ---------------- VALUE ---------------- */
function Value() {
  const cards = [
    { t: "Platform Stickiness", d: "Merchants stay because subscription state lives inside AEGIS." },
    { t: "New Verticals", d: "Unlock SaaS, media, membership, and utility billing on Nomba." },
    { t: "More Volume", d: "Automatic retries recover failed revenue and increase payment volume." },
  ];
  return (
    <section className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-6xl">
        <SectionHeader eyebrow="Why AEGIS" title="Built for Nomba. Built for Nigeria." />
        <div className="mt-20 grid grid-cols-1 gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <FadeUp key={c.t} delay={i * 0.1}>
              <div className="glass-card glass-card-hover h-full p-8">
                <h3 className="font-display text-xl font-semibold text-white">{c.t}</h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "#9CA3AF" }}>
                  {c.d}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FOOTER ---------------- */
function Footer() {
  return (
    <footer
      className="relative px-6 pb-12 pt-16"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div
              className="font-display font-bold text-white"
              style={{ letterSpacing: "0.2em", fontSize: "1.05rem" }}
            >
              AEGIS
            </div>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#6B7280" }}>
              The Subscription Reliability Layer for Nomba-Powered Businesses.
            </p>
          </div>
          <div>
            <Link to="/register" className="btn-primary">
              Start Building
            </Link>
          </div>
        </div>
        <div
          className="mt-16 text-center text-xs"
          style={{ color: "#6B7280", letterSpacing: "0.1em" }}
        >
          Built on Nomba · Hackathon 2026
        </div>
      </div>
    </footer>
  );
}

/* ---------------- PAGE ---------------- */
function LandingPage() {
  return (
    <main className="relative min-h-screen bg-[#0A0A0A] text-white">
      <Navbar />
      <Hero />
      <Problem />
      <Architecture />
      <Features />
      <Demo />
      <Value />
      <Footer />
    </main>
  );
}

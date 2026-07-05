import { type ReactNode } from "react";

function ECGLine() {
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
        className="absolute left-0 top-1/2 h-[200px] w-[200%] -translate-y-1/2 animate-[ecg-scroll-auth_22s_linear_infinite]"
        viewBox="0 0 1920 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={path}
          fill="none"
          stroke="#94A3B8"
          strokeOpacity="0.12"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <style>{`
        @keyframes ecg-scroll-auth {
          0% { transform: translate(0, -50%); }
          100% { transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0A0A0A]">
      {/* Left panel */}
      <aside
        className="relative hidden lg:flex lg:w-3/5 flex-col justify-between overflow-hidden p-12"
        style={{
          background:
            "radial-gradient(ellipse at top left, rgba(148,163,184,0.04), transparent 60%), #0A0A0A",
        }}
      >
        <ECGLine />

        <div className="relative z-10">
          <span
            className="font-display text-base font-bold text-white"
            style={{ letterSpacing: "0.2em" }}
          >
            AEGIS
          </span>
        </div>

        <div className="relative z-10 max-w-xl">
          <h1 className="font-display text-5xl xl:text-6xl font-bold leading-[1.05] text-white">
            Infrastructure that keeps revenue moving.
          </h1>
          <p className="mt-6 text-base text-[#6B7280] max-w-md">
            Automated billing, intelligent retry, zero reconciliation debt.
          </p>
        </div>

        <div className="relative z-10 text-xs text-[#6B7280]">
          Built on Nomba · Hackathon 2026
        </div>
      </aside>

      {/* Right panel */}
      <main className="flex w-full lg:w-2/5 items-center justify-center bg-[#111111] px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export function AuthInput({
  label,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-medium text-[#94A3B8]">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="w-full rounded-[10px] border border-white/[0.08] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none transition-colors focus:border-[#94A3B8]/40 focus:ring-1 focus:ring-[#94A3B8]/20"
      />
    </div>
  );
}

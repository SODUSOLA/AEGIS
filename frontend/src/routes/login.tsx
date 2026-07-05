import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — AEGIS" },
      { name: "description", content: "Log in to your AEGIS dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-bold text-white">Welcome back</h2>
        <p className="text-sm text-[#6B7280]">Log in to your AEGIS dashboard</p>
      </div>

      <form
        className="mt-10 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/dashboard" });
        }}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="block text-xs font-medium text-[#94A3B8]">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            className="w-full rounded-[10px] border border-white/[0.08] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none transition-colors focus:border-[#94A3B8]/40 focus:ring-1 focus:ring-[#94A3B8]/20"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-medium text-[#94A3B8]">
              Password
            </label>
            <a
              href="#"
              className="text-xs text-[#6B7280] transition-colors hover:text-[#94A3B8]"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-[10px] border border-white/[0.08] bg-[#1A1A1A] px-4 py-3 pr-12 text-sm text-white placeholder:text-[#6B7280] outline-none transition-colors focus:border-[#94A3B8]/40 focus:ring-1 focus:ring-[#94A3B8]/20"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] transition-colors hover:text-[#94A3B8]"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-[#94A3B8] py-3 text-sm font-semibold text-[#0A0A0A] transition-all hover:bg-[#b8c5d3] hover:shadow-[0_0_24px_rgba(148,163,184,0.18)]"
        >
          Log In
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[#6B7280]">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-[#94A3B8] hover:text-white">
          Get Started
        </Link>
      </p>
    </AuthLayout>
  );
}

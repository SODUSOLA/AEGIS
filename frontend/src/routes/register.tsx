import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout, AuthInput } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — AEGIS" },
      {
        name: "description",
        content: "Create your AEGIS account and start managing subscriptions in minutes.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-bold text-white">Create your account</h2>
        <p className="text-sm text-[#6B7280]">Start managing subscriptions in minutes</p>
      </div>

      <form
        className="mt-10 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/onboarding" });
        }}
      >
        <AuthInput
          id="business"
          label="Business Name"
          type="text"
          placeholder="Acme Inc."
          autoComplete="organization"
        />
        <AuthInput
          id="email"
          label="Email Address"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
        />

        <div className="space-y-2">
          <label htmlFor="password" className="block text-xs font-medium text-[#94A3B8]">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
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
          Create Account
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[#6B7280]">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-[#94A3B8] hover:text-white">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}

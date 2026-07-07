import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useApiKey } from "@/hooks/useApiKey";
import { aegis } from "@/api/aegis";

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
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setApiKey } = useApiKey();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await aegis.register(businessName, email, password);
      setApiKey(result.apiKey);
      navigate({ to: "/onboarding" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-bold text-white">Create your account</h2>
        <p className="text-sm text-[#6B7280]">Start managing subscriptions in minutes</p>
      </div>

      <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="business" className="block text-xs font-medium text-[#94A3B8]">
            Business Name
          </label>
          <input
            id="business"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Acme Inc."
            autoComplete="organization"
            required
            className="w-full rounded-[10px] border border-white/[0.08] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none transition-colors focus:border-[#94A3B8]/40 focus:ring-1 focus:ring-[#94A3B8]/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-xs font-medium text-[#94A3B8]">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
            className="w-full rounded-[10px] border border-white/[0.08] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none transition-colors focus:border-[#94A3B8]/40 focus:ring-1 focus:ring-[#94A3B8]/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-xs font-medium text-[#94A3B8]">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="•••••••• (min 8 characters)"
              autoComplete="new-password"
              required
              minLength={8}
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
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#94A3B8] py-3 text-sm font-semibold text-[#0A0A0A] transition-all hover:bg-[#b8c5d3] hover:shadow-[0_0_24px_rgba(148,163,184,0.18)] disabled:opacity-50"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Creating account..." : "Create Account"}
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

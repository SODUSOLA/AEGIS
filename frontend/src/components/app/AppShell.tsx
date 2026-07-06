import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  CreditCard,
  Home,
  Layers,
  LogOut,
  Moon,
  Radio,
  Repeat,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useTheme } from "@/lib/theme";

interface NavItem {
  label: string;
  to: string;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: Home },
  { label: "Plans", to: "/plans", icon: Layers },
  { label: "Subscriptions", to: "/subscriptions", icon: Repeat },
  { label: "Customers", to: "/customers", icon: Users },
  { label: "Transactions", to: "/transactions", icon: CreditCard },
  { label: "Webhooks", to: "/webhooks", icon: Radio },
  { label: "Dunning", to: "/dunning", icon: AlertTriangle },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function AppShell({
  title,
  eyebrow,
  business = "Lagos Coffee Co.",
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  business?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { tokens, mode, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const width = collapsed ? 64 : 240;

  const handleLogout = () => {
    try {
      localStorage.removeItem("aegis-session");
    } catch {}
    navigate({ to: "/login" });
  };

  return (
    <div style={{ minHeight: "100vh", background: tokens.bg, color: tokens.text, display: "flex" }}>
      {/* Sidebar */}
      <aside
        style={{
          position: "fixed",
          inset: "0 auto 0 0",
          width,
          background: tokens.surface,
          borderRight: `1px solid ${tokens.divider}`,
          display: "flex",
          flexDirection: "column",
          transition: "width 220ms cubic-bezier(0.16,1,0.3,1)",
          zIndex: 20,
        }}
      >
        {/* Top: logo + collapse */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: collapsed ? "20px 0" : "20px 20px",
            borderBottom: `1px solid ${tokens.divider}`,
            minHeight: 64,
          }}
        >
          {!collapsed && (
            <Link
              to="/dashboard"
              className="font-display"
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: tokens.text,
              }}
            >
              AEGIS
            </Link>
          )}
          {collapsed && (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: tokens.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0A0A0A",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              A
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              style={{
                background: "transparent",
                border: "none",
                color: tokens.muted,
                cursor: "pointer",
                padding: 4,
                display: "flex",
              }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            style={{
              background: "transparent",
              border: "none",
              color: tokens.muted,
              cursor: "pointer",
              padding: "8px 0",
              display: "flex",
              justifyContent: "center",
              borderBottom: `1px solid ${tokens.divider}`,
            }}
          >
            <ChevronLeft size={16} style={{ transform: "rotate(180deg)" }} />
          </button>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => {
            const active =
              item.to === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: collapsed ? "10px 0" : "10px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 8,
                  color: active ? tokens.accent : tokens.muted,
                  background: active
                    ? mode === "dark"
                      ? "rgba(148,163,184,0.08)"
                      : "rgba(148,163,184,0.12)"
                    : "transparent",
                  borderLeft: active ? `2px solid ${tokens.accent}` : "2px solid transparent",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  transition: "background 150ms ease, color 150ms ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = tokens.hover;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon size={16} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: "12px 8px", borderTop: `1px solid ${tokens.divider}` }}>
          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: collapsed ? "center" : "flex-start",
              padding: collapsed ? "10px 0" : "10px 12px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              color: tokens.muted,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <LogOut size={16} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: width, flex: 1, transition: "margin-left 220ms cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 16,
            padding: "16px 32px",
            borderBottom: `1px solid ${tokens.divider}`,
            background: tokens.bg,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <span style={{ color: tokens.muted, fontSize: 13 }}>{business}</span>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            style={{
              background: "transparent",
              border: `1px solid ${tokens.divider}`,
              color: tokens.text,
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: "32px", minWidth: 0 }}>
          <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              {eyebrow && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: tokens.accent,
                    marginBottom: 8,
                  }}
                >
                  {eyebrow}
                </div>
              )}
              <h1
                className="font-display"
                style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.01em", color: tokens.text, margin: 0 }}
              >
                {title}
              </h1>
            </div>
            {actions && <div style={{ display: "flex", gap: 12 }}>{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

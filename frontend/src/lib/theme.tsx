import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Mode = "dark" | "light";

export interface ThemeTokens {
  mode: Mode;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  divider: string;
  hover: string;
  accent: string;
}

const darkTokens: Omit<ThemeTokens, "mode"> = {
  bg: "#0A0A0A",
  surface: "#111111",
  text: "#FFFFFF",
  muted: "#6B7280",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "1px solid rgba(255,255,255,0.08)",
  cardShadow: "none",
  divider: "rgba(255,255,255,0.06)",
  hover: "rgba(255,255,255,0.04)",
  accent: "#94A3B8",
};

const lightTokens: Omit<ThemeTokens, "mode"> = {
  bg: "#FFFFFF",
  surface: "#F8FAFC",
  text: "#0A0A0A",
  muted: "#6B7280",
  cardBg: "#FFFFFF",
  cardBorder: "1px solid rgba(0,0,0,0.08)",
  cardShadow: "0 1px 4px rgba(0,0,0,0.08)",
  divider: "rgba(0,0,0,0.06)",
  hover: "rgba(0,0,0,0.03)",
  accent: "#94A3B8",
};

interface ThemeContextValue {
  tokens: ThemeTokens;
  mode: Mode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const saved = window.localStorage.getItem("aegis-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });

  useEffect(() => {
    try {
      localStorage.setItem("aegis-theme", mode);
    } catch {}
  }, [mode]);


  const value = useMemo<ThemeContextValue>(() => {
    const base = mode === "dark" ? darkTokens : lightTokens;
    return {
      mode,
      tokens: { mode, ...base },
      toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}

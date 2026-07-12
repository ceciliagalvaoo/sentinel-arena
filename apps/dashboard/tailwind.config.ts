import type { Config } from "tailwindcss";

// Validated palette — see the `dataviz` skill run in this project's session:
// aggressive/conservative categorical pair (ΔE 96–114, well above the
// CVD-safe floor of 12) and the warm-neutral chrome from references/palette.md.
// Every color below is a CSS custom property so light/dark swap in one place
// (app/globals.css) — Tailwind classes reference roles, never raw hex.
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        ink: "var(--ink)",
        "ink-secondary": "var(--ink-secondary)",
        "ink-muted": "var(--ink-muted)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        aggressive: "var(--aggressive)",
        "aggressive-soft": "var(--aggressive-soft)",
        conservative: "var(--conservative)",
        "conservative-soft": "var(--conservative-soft)",
        good: "var(--good)",
        warning: "var(--warning)",
        serious: "var(--serious)",
        critical: "var(--critical)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "squirrel-idle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "squirrel-alert": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "30%": { transform: "translateY(-4px) scale(1.03)" },
          "60%": { transform: "translateY(0) scale(1)" },
        },
        "squirrel-cheer": {
          "0%, 100%": { transform: "translateY(0) scale(1) rotate(0deg)" },
          "20%": { transform: "translateY(-6px) scale(1.08) rotate(-4deg)" },
          "40%": { transform: "translateY(-1px) scale(1.03) rotate(4deg)" },
          "60%": { transform: "translateY(-6px) scale(1.08) rotate(-3deg)" },
          "80%": { transform: "translateY(0) scale(1.02) rotate(2deg)" },
        },
        "squirrel-wince": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(2px) rotate(-3deg)" },
          "50%": { transform: "translateY(3px) rotate(3deg)" },
          "75%": { transform: "translateY(2px) rotate(-2deg)" },
        },
        "tail-flick": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(-6deg)" },
        },
        "stage-flash": {
          "0%": { backgroundColor: "var(--accent-flash)", transform: "scale(1.01)" },
          "100%": { backgroundColor: "transparent", transform: "scale(1)" },
        },
        "row-enter": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        "squirrel-idle": "squirrel-idle 2.4s ease-in-out infinite",
        "squirrel-alert": "squirrel-alert 0.6s ease-in-out 2",
        "squirrel-cheer": "squirrel-cheer 0.7s ease-in-out 2",
        "squirrel-wince": "squirrel-wince 0.6s ease-in-out 2",
        "tail-flick": "tail-flick 1.8s ease-in-out infinite",
        "stage-flash": "stage-flash 1.2s ease-out",
        "row-enter": "row-enter 0.35s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

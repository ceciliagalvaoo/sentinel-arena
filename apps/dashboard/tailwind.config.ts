import type { Config } from "tailwindcss";

// Arcade dark-only theme. Every color is a CSS custom property defined in
// app/globals.css — there is a single theme, so no darkMode strategy. Tailwind
// classes reference roles (bg, panel, ink, rush, sage…), never raw hex.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--arc-bg)",
        "bg-deep": "var(--arc-bg-deep)",
        panel: "var(--arc-panel)",
        "panel-soft": "var(--arc-panel-soft)",
        "panel-row": "var(--arc-panel-row)",
        "panel-raised": "var(--arc-panel-raised)",
        arcborder: "var(--arc-border)",
        arcshadow: "var(--arc-shadow)",
        ink: "var(--arc-ink)",
        "ink-soft": "var(--arc-ink-soft)",
        muted: "var(--arc-muted)",
        rush: "var(--rush)",
        "rush-dark": "var(--rush-dark)",
        sage: "var(--sage)",
        "sage-dark": "var(--sage-dark)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        good: "var(--good)",
        warn: "var(--warn)",
        bad: "var(--bad)",
      },
      fontFamily: {
        pixel: ["var(--font-pixel)"],
      },
    },
  },
  plugins: [],
};

export default config;

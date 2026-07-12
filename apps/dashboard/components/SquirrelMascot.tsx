"use client";

import { useMemo } from "react";
import {
  AGGRESSIVE_ALERT,
  AGGRESSIVE_IDLE,
  buildSpriteGrid,
  CONSERVATIVE_ALERT,
  CONSERVATIVE_IDLE,
  type PixelToken,
} from "@/lib/squirrel-sprites";

export type SquirrelVariant = "aggressive" | "conservative";
/** idle = nothing happening. alert = a new signal just landed. correct/incorrect = a grade just resolved for one. */
export type MascotMood = "idle" | "alert" | "correct" | "incorrect";

interface SquirrelMascotProps {
  variant: SquirrelVariant;
  mood?: MascotMood;
  className?: string;
}

const UNIT = 4;
const COLS = 13;

const COLOR_MAP: Record<SquirrelVariant, Partial<Record<PixelToken, string>>> = {
  aggressive: {
    T: "var(--aggressive-dark)",
    A: "var(--aggressive-dark)",
    H: "var(--aggressive)",
    B: "var(--aggressive)",
    P: "var(--aggressive)",
    F: "var(--aggressive-dark)",
    E: "var(--mascot-eye)",
    O: "var(--mascot-belly)",
  },
  conservative: {
    T: "var(--conservative-dark)",
    A: "var(--conservative-dark)",
    H: "var(--conservative)",
    B: "var(--conservative)",
    P: "var(--conservative)",
    F: "var(--conservative-dark)",
    E: "var(--mascot-eye)",
    O: "var(--mascot-belly)",
  },
};

const GRIDS: Record<SquirrelVariant, { idle: PixelToken[][]; alert: PixelToken[][] }> = {
  aggressive: {
    idle: buildSpriteGrid(AGGRESSIVE_IDLE),
    alert: buildSpriteGrid(AGGRESSIVE_ALERT),
  },
  conservative: {
    idle: buildSpriteGrid(CONSERVATIVE_IDLE),
    alert: buildSpriteGrid(CONSERVATIVE_ALERT),
  },
};

/** Conservative reacts slower/gentler than Aggressive across every mood — same animations, longer durations. */
const DURATION_OVERRIDE: Record<SquirrelVariant, string> = {
  aggressive: "",
  conservative: "[animation-duration:3.6s]",
};
const CHEER_DURATION_OVERRIDE: Record<SquirrelVariant, string> = {
  aggressive: "",
  conservative: "[animation-duration:1.1s]",
};
const WINCE_DURATION_OVERRIDE: Record<SquirrelVariant, string> = {
  aggressive: "",
  conservative: "[animation-duration:1s]",
};

/**
 * Original pixel-art squirrel mascot — not based on any existing character.
 * Two hand-placed frames (idle / alert) swap based on `mood` — correct and
 * incorrect both reuse the alert (eyes-open) frame, since the distinction
 * between them is carried by motion, not a third hand-drawn pose: a bouncy
 * "cheer" wiggle for a correct grade, a droopy "wince" shake for a wrong
 * one. Aggressive plays every reaction faster/bigger, Conservative slower —
 * matching their taglines, not just their color.
 */
export function SquirrelMascot({ variant, mood = "idle", className }: SquirrelMascotProps) {
  const grid = mood === "idle" ? GRIDS[variant].idle : GRIDS[variant].alert;
  const colors = COLOR_MAP[variant];
  const rows = grid.length;

  const rects = useMemo(() => {
    const elements: React.ReactElement[] = [];
    grid.forEach((row, y) => {
      row.forEach((token, x) => {
        if (token === ".") return;
        elements.push(
          <rect key={`${x}-${y}`} x={x * UNIT} y={y * UNIT} width={UNIT} height={UNIT} fill={colors[token]} />,
        );
      });
    });
    return elements;
  }, [grid, colors]);

  const animationClass =
    mood === "correct"
      ? `animate-squirrel-cheer ${CHEER_DURATION_OVERRIDE[variant]}`
      : mood === "incorrect"
        ? `animate-squirrel-wince ${WINCE_DURATION_OVERRIDE[variant]}`
        : mood === "alert"
          ? "animate-squirrel-alert"
          : `animate-squirrel-idle ${DURATION_OVERRIDE[variant]}`;

  return (
    <svg
      viewBox={`0 0 ${COLS * UNIT} ${rows * UNIT}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      className={`pixel-art ${animationClass} ${className ?? ""}`}
      role="img"
      aria-label={variant === "aggressive" ? "Agent-Aggressive's mascot, an alert squirrel" : "Agent-Conservative's mascot, a watchful squirrel"}
    >
      {rects}
    </svg>
  );
}

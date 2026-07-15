"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SignalWithLifecycle } from "@/lib/types";

interface ComparisonChartProps {
  rushSignals: SignalWithLifecycle[];
  sageSignals: SignalWithLifecycle[];
}

interface Pt {
  ts: number;
  value: number;
}

interface Hover {
  cssX: number;
  ts: number;
  rushV: number | null;
  sageV: number | null;
}

const HEIGHT = 176;
const PAD = { l: 34, r: 12, t: 14, b: 24 };
const RUSH = "#e0392b";
const SAGE = "#f59e1b";

/**
 * Cumulative accuracy keyed by each signal's detectedAt (game time), not
 * gradedAt — grading happens in batches whenever a fixture is finalized, so
 * plotting by gradedAt clumps every signal from a match onto nearly the same
 * timestamp regardless of when it actually fired. Points still only appear
 * once `grade` lands (a pending signal has no correct/incorrect value yet),
 * but the X position reflects when the agent actually detected it.
 */
function cumulativeSeries(signals: SignalWithLifecycle[]): Pt[] {
  const graded = signals
    .filter((s) => s.grade !== null)
    .slice()
    .sort((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt));
  let ok = 0;
  return graded.map((s, i) => {
    if (s.grade!.correct) ok += 1;
    return { ts: Date.parse(s.detectedAt), value: ok / (i + 1) };
  });
}

/** Carry-forward value of a step series at time t (the accuracy "as of" that moment). */
function valueAt(pts: Pt[], t: number): number | null {
  let v: number | null = null;
  for (const p of pts) {
    if (p.ts <= t) v = p.value;
    else break;
  }
  return v;
}

function fmtTime(ts: number, withSeconds = false): string {
  const date = new Date(ts);
  const datePart = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
  return `${datePart} ${timePart}`;
}

/**
 * Cumulative accuracy, one pixel-styled step-line per agent, drawn on a crisp
 * (device-pixel-ratio aware) canvas — the arcade replacement for the original
 * Recharts chart, keeping its two things that matter: progression over real
 * time on the X axis, and a hover tooltip that reads back the history at any
 * point (time + each agent's accuracy-so-far, with a crosshair).
 */
export function ComparisonChart({ rushSignals, sageSignals }: ComparisonChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  // domain of the last draw, read by the mouse handler to map x → time.
  const domainRef = useRef<{ tMin: number; span: number; plotW: number } | null>(null);

  const rush = cumulativeSeries(rushSignals);
  const sage = cumulativeSeries(sageSignals);
  const empty = rush.length === 0 && sage.length === 0;

  // Track the wrapper's width so the canvas stays crisp and full-bleed.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    setWidth(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(
    (h: Hover | null) => {
      const canvas = canvasRef.current;
      if (!canvas || width === 0 || empty) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = HEIGHT * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${HEIGHT}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);

      const plotW = width - PAD.l - PAD.r;
      const plotH = HEIGHT - PAD.t - PAD.b;
      const all = [...rush, ...sage];
      const tMin = Math.min(...all.map((p) => p.ts));
      const tMax = Math.max(...all.map((p) => p.ts));
      const span = Math.max(tMax - tMin, 1);
      domainRef.current = { tMin, span, plotW };

      const X = (ts: number) => PAD.l + ((ts - tMin) / span) * plotW;
      const Y = (v: number) => PAD.t + (1 - v) * plotH;

      ctx.fillStyle = "#232327";
      ctx.fillRect(0, 0, width, HEIGHT);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textBaseline = "middle";

      // horizontal gridlines + y labels (0/25/50/75/100)
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        const y = Y(v);
        ctx.strokeStyle = "#3f3f48";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(width - PAD.r, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#8f8f98";
        ctx.textAlign = "right";
        ctx.fillText(String(Math.round(v * 100)), PAD.l - 5, y);
      }

      // x-axis time ticks
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i <= 3; i++) {
        const ts = tMin + (span * i) / 3;
        const x = Math.max(PAD.l + 12, Math.min(width - PAD.r - 12, X(ts)));
        ctx.fillStyle = "#8f8f98";
        ctx.fillText(fmtTime(ts), x, HEIGHT - PAD.b + 6);
      }
      ctx.textBaseline = "middle";

      // step-after line per agent
      const plot = (pts: Pt[], color: string) => {
        if (!pts.length) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(X(pts[0]!.ts), Y(pts[0]!.value));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(X(pts[i]!.ts), Y(pts[i - 1]!.value));
          ctx.lineTo(X(pts[i]!.ts), Y(pts[i]!.value));
        }
        ctx.stroke();
      };
      plot(rush, RUSH);
      plot(sage, SAGE);

      // hover crosshair + point markers
      if (h) {
        const hx = X(h.ts);
        ctx.strokeStyle = "#8f8f98";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(hx, PAD.t);
        ctx.lineTo(hx, HEIGHT - PAD.b);
        ctx.stroke();
        ctx.setLineDash([]);
        const dot = (v: number | null, color: string) => {
          if (v === null) return;
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(hx) - 2, Math.round(Y(v)) - 2, 5, 5);
        };
        dot(h.rushV, RUSH);
        dot(h.sageV, SAGE);
      }
    },
    [width, empty, rush, sage],
  );

  useEffect(() => {
    draw(hover);
  }, [draw, hover]);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const dom = domainRef.current;
      if (!canvas || !dom) return;
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const clampedX = Math.max(PAD.l, Math.min(width - PAD.r, cssX));
      const ts = dom.tMin + ((clampedX - PAD.l) / dom.plotW) * dom.span;
      setHover({ cssX: clampedX, ts, rushV: valueAt(rush, ts), sageV: valueAt(sage, ts) });
    },
    [width, rush, sage],
  );

  return (
    <section className="flex w-full max-w-[920px] flex-col gap-3 py-1">
      <div className="text-[10px] tracking-widest text-muted">
        CUMULATIVE ACCURACY — <span className="text-rush">RUSH</span> × <span className="text-sage">SAGE</span>
      </div>

      {/* The wrapper is ALWAYS rendered (even while empty) so the ResizeObserver
          attaches on mount and has a real width the moment the first graded
          signal arrives — otherwise the canvas would stay 0-wide and blank. */}
      <div ref={wrapRef} className="relative w-full">
        {empty ? (
          <div className="bg-panel-row p-6 text-center text-[8px] leading-relaxed text-muted">
            NO GRADED SIGNALS YET — THE CHART APPEARS ONCE THE FIRST RESULT IS CONFIRMED
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} className="block w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
            {hover && (
              <div
                className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap border border-arcborder bg-panel px-2 py-1.5 text-[7px] leading-relaxed text-ink"
                style={{ left: `${Math.max(52, Math.min(width - 52, hover.cssX))}px` }}
              >
                <div className="text-muted">{fmtTime(hover.ts, true)}</div>
                <div className="text-rush">RUSH {hover.rushV === null ? "—" : `${(hover.rushV * 100).toFixed(1)}%`}</div>
                <div className="text-sage">SAGE {hover.sageV === null ? "—" : `${(hover.sageV * 100).toFixed(1)}%`}</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-5 text-[8px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-3.5 bg-rush" />
          RUSH (AGGRESSIVE)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-3.5 bg-sage" />
          SAGE (CONSERVATIVE)
        </span>
      </div>
    </section>
  );
}

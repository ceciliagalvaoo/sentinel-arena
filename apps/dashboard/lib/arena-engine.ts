/**
 * The Arena animation engine — pure TypeScript, no React. Ported from the
 * approved design's canvas controller (INTEGRATION.md §3). Renders the two
 * squirrel actors (Rush left, Sage right) onto a <canvas> via requestAnimation-
 * Frame, and exposes react()/startWin() so the React layer can drive it from
 * real signal/grade events instead of the design's mock timeline.
 *
 * Nothing here reaches the network or Solana — it's purely presentational.
 */
import {
  FRAMES,
  PALETTES,
  SPRITE_BASE_W,
  TREE1,
  TREE2,
  TREE_PALETTE,
  type Anim,
  type Palette,
  type SpriteGrid,
} from "./arena-sprites";

export type ActorName = "rush" | "sage";

interface Actor {
  home: number;
  x: number;
  dir: 1 | -1;
  anim: Anim;
  t0: number;
  backTimer: ReturnType<typeof setTimeout> | null;
}

interface WinSeq {
  winner: ActorName;
  loser: ActorName;
  t0: number;
}

interface Star {
  x: number;
  y: number;
  c: string;
}

const SCENE_W = 320;
const GROUND_Y = 108;
const SCALE = 2;
const REACT_HOLD_MS = 1900;

export interface EngineOptions {
  /** Frames per second for sprite cycling (3–12). */
  fps: () => number;
  /** Idle "breathing" bob. */
  bob: () => boolean;
}

export class ArenaEngine {
  private readonly actors: Record<ActorName, Actor> = {
    rush: { home: 62, x: 62, dir: 1, anim: "idle", t0: 0, backTimer: null },
    sage: { home: 226, x: 226, dir: -1, anim: "idle", t0: 0, backTimer: null },
  };
  private seq: WinSeq | null = null;
  private readonly stars: Star[] = [];
  private raf: number | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(private readonly opts: EngineOptions) {
    // Deterministic star field (no Math.random — stable across reloads).
    let s = 7;
    for (let i = 0; i < 26; i++) {
      s = (s * 16807) % 2147483647;
      const x = s % SCENE_W;
      s = (s * 16807) % 2147483647;
      const y = s % 62;
      this.stars.push({ x, y, c: i % 4 === 0 ? "#5a5a68" : "#3d3d47" });
    }
  }

  start(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const tick = (now: number) => {
      this.runSeq(now);
      this.drawScene(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    for (const n of ["rush", "sage"] as const) {
      const t = this.actors[n].backTimer;
      if (t) clearTimeout(t);
    }
  }

  /** Fire a one-shot reaction (eat/hop/sad) that auto-returns to idle. Ignored mid win-sequence. */
  react(name: ActorName, anim: Anim): void {
    if (this.seq) return;
    const a = this.actors[name];
    a.anim = anim;
    a.t0 = performance.now();
    if (a.backTimer) clearTimeout(a.backTimer);
    a.backTimer = setTimeout(() => {
      if (a.anim === anim && !this.seq) {
        a.anim = "idle";
        a.t0 = performance.now();
      }
    }, REACT_HOLD_MS);
  }

  /** Begin the end-of-round KO: winner walks over, punches, loser takes the hit. */
  startWin(winner: ActorName, loser: ActorName): void {
    this.resetAll();
    this.seq = { winner, loser, t0: performance.now() };
  }

  resetAll(): void {
    this.seq = null;
    const now = performance.now();
    for (const n of ["rush", "sage"] as const) {
      const a = this.actors[n];
      if (a.backTimer) clearTimeout(a.backTimer);
      a.backTimer = null;
      a.anim = "idle";
      a.t0 = now;
      a.x = a.home;
    }
  }

  // ---------- drawing ----------
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    grid: SpriteGrid,
    pal: Palette,
    x: number,
    yBottom: number,
    scale: number,
    mirror: boolean,
    baseW?: number,
  ): void {
    const h = grid.length;
    const w = grid[0]!.length;
    const ox = mirror ? x - (w - (baseW ?? w)) * scale : x;
    const oy = yBottom - h * scale;
    for (let ry = 0; ry < h; ry++) {
      const row = grid[ry]!;
      for (let cx = 0; cx < w; cx++) {
        const ch = mirror ? row[w - 1 - cx] : row[cx];
        if (ch === "." || !ch || !pal[ch]) continue;
        ctx.fillStyle = pal[ch]!;
        ctx.fillRect(ox + cx * scale, oy + ry * scale, scale, scale);
      }
    }
  }

  private getFrame(a: Actor, now: number): { grid: SpriteGrid; dy: number } {
    const fps = this.opts.fps();
    const frames = FRAMES[a.anim];
    const rate = a.anim === "walk" ? fps * 2.2 : fps;
    let idx = Math.floor((now - a.t0) / (1000 / rate));
    if (a.anim === "punch") idx = Math.min(idx, frames.length - 1);
    else idx = ((idx % frames.length) + frames.length) % frames.length;
    let dy = 0;
    if (a.anim === "hop" && idx === 1) dy = -9;
    if (a.anim === "walk") dy = -Math.abs(Math.sin((now - a.t0) / 95)) * 3;
    if (a.anim === "sad" && idx === 1) dy = 1;
    if (this.opts.bob() && a.anim === "idle" && idx === 1) dy = -1;
    return { grid: frames[idx]!, dy };
  }

  private drawScene(now: number): void {
    const cv = this.canvas;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const W = cv.width;
    const H = cv.height;

    ctx.fillStyle = "#232327";
    ctx.fillRect(0, 0, W, H);
    for (const st of this.stars) {
      ctx.fillStyle = st.c;
      ctx.fillRect(st.x, st.y, 2, 2);
    }
    // ground
    ctx.fillStyle = "#2c2c33";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#4a4a54";
    ctx.fillRect(0, GROUND_Y, W, 2);
    ctx.fillStyle = "#357040";
    for (let gx = 4; gx < W; gx += 22) ctx.fillRect(gx, GROUND_Y - 2, 2, 2);
    // trees
    this.drawGrid(ctx, TREE1, TREE_PALETTE, 8, GROUND_Y, SCALE, false);
    this.drawGrid(ctx, TREE2, TREE_PALETTE, W - 8 - TREE2[0]!.length * SCALE, GROUND_Y, SCALE, false);
    // actors
    for (const name of ["rush", "sage"] as const) {
      const a = this.actors[name];
      const f = this.getFrame(a, now);
      const mirror = a.dir < 0;
      this.drawGrid(ctx, f.grid, PALETTES[name], Math.round(a.x), GROUND_Y + Math.round(f.dy), SCALE, mirror, SPRITE_BASE_W);
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillStyle = name === "rush" ? "#e0392b" : "#f59e1b";
      ctx.fillText(name.toUpperCase(), Math.round(a.x) + 14, GROUND_Y - 40 + (a.anim === "hop" ? f.dy : 0));
    }
  }

  private runSeq(now: number): void {
    const q = this.seq;
    if (!q) return;
    const e = now - q.t0;
    const w = this.actors[q.winner];
    const l = this.actors[q.loser];
    const strikeX = l.home - w.dir * 34;
    const set = (a: Actor, anim: Anim) => {
      if (a.anim !== anim) {
        a.anim = anim;
        a.t0 = now;
      }
    };
    if (e < 900) {
      set(w, "walk");
      w.x = w.home + (strikeX - w.home) * (e / 900);
    } else if (e < 1400) {
      w.x = strikeX;
      set(w, "punch");
      set(l, "idle");
    } else if (e < 2600) {
      set(l, "hit");
      const k = Math.min(1, (e - 1400) / 220);
      l.x = l.home + w.dir * 12 * k;
    } else if (e < 5400) {
      set(w, "hop");
      set(l, "sad");
    } else {
      this.resetAll();
    }
  }
}

/**
 * Draws a single idle squirrel frame into a small canvas (the header lockup
 * and tutorial minis). Scale 1 fills a 14×16 canvas; CSS upscales with
 * image-rendering:pixelated. Sage is mirrored by the caller via CSS scaleX(-1).
 */
export function drawMiniSquirrel(canvas: HTMLCanvasElement, variant: ActorName): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grid = FRAMES.idle[0];
  const pal = PALETTES[variant];
  const h = grid.length;
  const w = grid[0]!.length;
  const oy = 16 - h; // bottom-align in a 16px-tall canvas
  for (let ry = 0; ry < h; ry++) {
    const row = grid[ry]!;
    for (let cx = 0; cx < w; cx++) {
      const ch = row[cx]!;
      if (ch === "." || !pal[ch]) continue;
      ctx.fillStyle = pal[ch]!;
      ctx.fillRect(cx, oy + ry, 1, 1);
    }
  }
}

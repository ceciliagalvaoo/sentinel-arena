/**
 * Procedural 12×8 pixel flags, painted on a tiny canvas (CSS upscales with
 * image-rendering:pixelated). Ported from the approved design. Any country is
 * a few stripes + a simple emblem; unknown teams fall back to a grey "TBD"
 * tile. The real app has team NAMES (not flag codes), so flagKeyForTeam maps
 * the countries we can recognise and returns "tbd" for the rest — purely
 * cosmetic, never blocks anything.
 */

export type FlagKey =
  | "fra"
  | "mar"
  | "bra"
  | "arg"
  | "eng"
  | "ger"
  | "esp"
  | "por"
  | "ned"
  | "jpn"
  | "usa"
  | "mex"
  | "tbd";

function hstripes(c: CanvasRenderingContext2D, cols: string[]): void {
  const h = 8 / cols.length;
  cols.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(0, Math.round(i * h), 12, Math.ceil(h));
  });
}

function vstripes(c: CanvasRenderingContext2D, cols: string[]): void {
  const w = 12 / cols.length;
  cols.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(Math.round(i * w), 0, Math.ceil(w), 8);
  });
}

function flagPainter(key: FlagKey, c: CanvasRenderingContext2D): void {
  switch (key) {
    case "fra":
      vstripes(c, ["#2a4fc9", "#f2efe6", "#d6392e"]);
      break;
    case "mar":
      c.fillStyle = "#cf3a2c";
      c.fillRect(0, 0, 12, 8);
      c.fillStyle = "#2f8f4e";
      c.fillRect(5, 2, 2, 1);
      c.fillRect(4, 3, 4, 1);
      c.fillRect(5, 4, 2, 1);
      break;
    case "bra":
      c.fillStyle = "#2f9e41";
      c.fillRect(0, 0, 12, 8);
      c.fillStyle = "#f5c518";
      c.fillRect(3, 3, 6, 2);
      c.fillRect(4, 2, 4, 4);
      c.fillStyle = "#21468b";
      c.fillRect(5, 3, 2, 2);
      break;
    case "arg":
      hstripes(c, ["#74acdf", "#f2efe6", "#74acdf"]);
      c.fillStyle = "#f5b921";
      c.fillRect(5, 3, 2, 2);
      break;
    case "eng":
      c.fillStyle = "#f2efe6";
      c.fillRect(0, 0, 12, 8);
      c.fillStyle = "#d6392e";
      c.fillRect(5, 0, 2, 8);
      c.fillRect(0, 3, 12, 2);
      break;
    case "ger":
      hstripes(c, ["#1c1410", "#d6392e", "#f5c518"]);
      break;
    case "esp":
      c.fillStyle = "#c60b1e";
      c.fillRect(0, 0, 12, 8);
      c.fillStyle = "#f5c518";
      c.fillRect(0, 2, 12, 4);
      break;
    case "por":
      c.fillStyle = "#2f9e41";
      c.fillRect(0, 0, 5, 8);
      c.fillStyle = "#d6392e";
      c.fillRect(5, 0, 7, 8);
      c.fillStyle = "#f5c518";
      c.fillRect(4, 3, 2, 2);
      break;
    case "ned":
      hstripes(c, ["#c8102e", "#f2efe6", "#21468b"]);
      break;
    case "jpn":
      c.fillStyle = "#f2efe6";
      c.fillRect(0, 0, 12, 8);
      c.fillStyle = "#d6392e";
      c.fillRect(4, 3, 4, 2);
      c.fillRect(5, 2, 2, 4);
      break;
    case "usa":
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? "#f2efe6" : "#c8102e";
        c.fillRect(0, i, 12, 1);
      }
      c.fillStyle = "#21468b";
      c.fillRect(0, 0, 5, 4);
      break;
    case "mex":
      vstripes(c, ["#2f9e41", "#f2efe6", "#c8102e"]);
      c.fillStyle = "#6e4a22";
      c.fillRect(5, 3, 2, 2);
      break;
    default:
      c.fillStyle = "#3f3f48";
      c.fillRect(0, 0, 12, 8);
  }
}

/** Paints the flag for `key` into a 12×8 canvas (clears first). */
export function paintFlag(canvas: HTMLCanvasElement, key: FlagKey): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 12, 8);
  flagPainter(key, ctx);
}

const TEAM_TO_FLAG: Record<string, FlagKey> = {
  france: "fra",
  morocco: "mar",
  brazil: "bra",
  argentina: "arg",
  england: "eng",
  germany: "ger",
  spain: "esp",
  portugal: "por",
  netherlands: "ned",
  holland: "ned",
  japan: "jpn",
  "united states": "usa",
  usa: "usa",
  mexico: "mex",
};

/** Best-effort map from a fixture participant name to a flag key; "tbd" fallback. */
export function flagKeyForTeam(name: string | null | undefined): FlagKey {
  if (!name) return "tbd";
  return TEAM_TO_FLAG[name.trim().toLowerCase()] ?? "tbd";
}

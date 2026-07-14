/**
 * Pixel-art squirrel sprites for the Arena scene — an original design (not
 * based on any existing character). Each frame is a grid of single-character
 * tokens, 1 char = 1 pixel, recolored per agent via PALETTES. Ported verbatim
 * from the approved design (INTEGRATION.md §3); editing a frame = editing its
 * strings.
 *
 * Tokens: B body · T tail(dark) · L belly · E eye · W white(flash/teeth) ·
 * F feet/dark · A acorn · a acorn cap · G leaf · g leaf-dark · K trunk · k trunk-dark
 */

export type SpriteGrid = string[];

/** Pads every row to the widest row's length so a grid is a clean rectangle. */
function pad(rows: string[]): SpriteGrid {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => (r + ".".repeat(w - r.length)).slice(0, w));
}

const IDLE1 = pad([
  ".TT...........",
  "TTTT..........",
  "TTTT.BB...BB..",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBEBBBEBB.",
  "..T.BBBBBBBBB.",
  "..TTBBLLLLLBB.",
  "..TTBBBLLLBBB.",
  "..T.BBLLLLLBB.",
  "..TBBBLLLLLBB.",
  "...BBBLLLLLBB.",
  "...BBBBBBBBBB.",
  "....BBB..BBB..",
  "....FF....FF..",
  "..............",
]);

const IDLE2 = pad([
  "TT............",
  "TTT...........",
  "TTTT.BB...BB..",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBEBBBEBB.",
  "..T.BBBBBBBBB.",
  "..TTBBLLLLLBB.",
  "..TTBBBLLLBBB.",
  "..T.BBLLLLLBB.",
  "..TBBBLLLLLBB.",
  "...BBBLLLLLBB.",
  "...BBBBBBBBBB.",
  "....BBB..BBB..",
  "....FF....FF..",
  "..............",
]);

const EAT1 = pad([
  ".TT...........",
  "TTTT..........",
  "TTTT.BB...BB..",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBEBBBEBB.",
  "..T.BBBaAaBBB.",
  "..TTBBLAAALBB.",
  "..TTBBBAAABBB.",
  "..T.BBLLLLLBB.",
  "..TBBBLLLLLBB.",
  "...BBBLLLLLBB.",
  "...BBBBBBBBBB.",
  "....BBB..BBB..",
  "....FF....FF..",
  "..............",
]);

const EAT2 = pad([
  ".TT...........",
  "TTTT..........",
  "TTTT.BB...BB..",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBEBBBEBB.",
  "..T.BBBWWBBBB.",
  "..TTBBLLLLLBB.",
  "..TTBBBLLLBBB.",
  "..T.BBLAAALBB.",
  "..TBBBLAAALBB.",
  "...BBBLLLLLBB.",
  "...BBBBBBBBBB.",
  "....BBB..BBB..",
  "....FF....FF..",
  "..............",
]);

const HOP1 = pad([
  "..............",
  "..............",
  "..............",
  ".TT...........",
  "TTTT..........",
  "TTTT.BB...BB..",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBEBBBEBB.",
  "..T.BBBBBBBBB.",
  "..TTBBLLLLLBB.",
  "..TTBBBLLLBBB.",
  "..TBBBLLLLLBB.",
  "..BBBBBBBBBBB.",
  "...FFF...FFF..",
  "..............",
]);

const HOP2 = pad([
  "..............",
  ".BB.........BB",
  "..B..........B",
  "..B.BB....BB.B",
  "...BBBBBBBBBB.",
  "....BBEBBBEBB.",
  "....BBBWWBBBB.",
  "..T.BBLLLLLBB.",
  ".TT.BBBLLLBBB.",
  ".TT.BBLLLLLBB.",
  "TTT.BBLLLLLBB.",
  "TT.BBBLLLLLBB.",
  "T..BBBBBBBBBB.",
  "...BBB....BBB.",
  "...FF......FF.",
  "..............",
]);

const SAD1 = pad([
  "..............",
  "..............",
  "..............",
  "..............",
  "....BBBBBBBBB.",
  "...BBBBBBBBBBB",
  "....BBEBBBEBB.",
  "....BBLLLLLBB.",
  "....BBLFFFLBB.",
  "...TBBLLLLLBB.",
  "...TBBLLLLLBB.",
  "...TBBLLLLLBB.",
  "..TTBBBBBBBBB.",
  ".TTT.BBB.BBB..",
  ".TT..FF...FF..",
  "..............",
]);

const SAD2 = pad([
  "..............",
  "..............",
  "..............",
  "..............",
  "....BBBBBBBBB.",
  "...BBBBBBBBBBB",
  "....BBEBBBEBB.",
  "....BBWLLLLBB.",
  "....BBLFFFLBB.",
  "...TBBLLLLLBB.",
  "...TBBLLLLLBB.",
  "...TBBLLLLLBB.",
  "..TTBBBBBBBBB.",
  ".TTT.BBB.BBB..",
  ".TT..FF...FF..",
  "..............",
]);

const PUNCH1 = pad([
  ".TT...........",
  "TTTT..........",
  "TTTT.BB...BB..",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBEBBBEBB.",
  "..T.BBBBBBBBBB",
  "..TTBBLLLLLBBB",
  "..TTBBBLLLBBB.",
  "..T.BBLLLLLBB.",
  "..TBBBLLLLLBB.",
  "...BBBLLLLLBB.",
  "...BBBBBBBBBB.",
  "....BBB..BBB..",
  "....FF....FF..",
  "..............",
]);

const PUNCH2 = pad([
  ".TT.............",
  "TTTT............",
  "TTTT.BB...BB....",
  "TTTT.BB...BB....",
  ".TTTBBBBBBBBB...",
  ".TT.BBEBBBEBB...",
  "..T.BBBBBBBBB...",
  "..TTBBLLLLLBBBBB",
  "..TTBBBLLLBBBBBB",
  "..T.BBLLLLLBB...",
  "..TBBBLLLLLBB...",
  "...BBBLLLLLBB...",
  "...BBBBBBBBBB...",
  "....BBB..BBB....",
  "....FF....FF....",
  "................",
]);

const HIT1 = pad([
  "..............",
  "..............",
  "...W......W...",
  "..............",
  ".TT...........",
  "TTTT..........",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBWBBBWBB.",
  "..T.BBBFFFBBB.",
  "..TTBBLLLLLBB.",
  "..TBBBLLLLLBB.",
  "..BBBBBBBBBBB.",
  "...FFF...FFF..",
  "..............",
  "..............",
]);

const HIT2 = pad([
  "..............",
  "..............",
  ".W..........W.",
  "..............",
  ".TT...........",
  "TTTT..........",
  "TTTT.BB...BB..",
  ".TTTBBBBBBBBB.",
  ".TT.BBWBBBWBB.",
  "..T.BBBFFFBBB.",
  "..TTBBLLLLLBB.",
  "..TBBBLLLLLBB.",
  "..BBBBBBBBBBB.",
  "...FFF...FFF..",
  "..............",
  "..............",
]);

export const TREE1 = pad([
  "....GGGGGGG.....",
  "..GGGGGGGGGGG...",
  ".GGGGGGgGGGGGG..",
  ".GGgGGGGGGGGGGG.",
  "GGGGGGGGGGgGGGG.",
  "GGgGGGGGGGGGGGGG",
  "GGGGGGgGGGGGgGGG",
  ".GGGGGGGGGGGGGG.",
  ".GgGGGGGgGGGGG..",
  "..GGGGGGGGGGG...",
  "...GGGgGGGG.....",
  ".....GGGG.......",
  ".......KK.......",
  ".......KK.......",
  "......KKK.......",
  "......KK........",
  "......KKk.......",
  "......KK........",
  ".....KKKK.......",
  "....KKKKKK......",
]);

export const TREE2 = pad([
  ".....GGGG.....",
  "...GGGGGGGG...",
  "..GGGGgGGGGG..",
  "..GGGGGGGGGG..",
  "...GGGGGGGG...",
  ".GGGGgGGGGGGG.",
  "GGGGGGGGGGgGGG",
  "GGgGGGGGGGGGGG",
  ".GGGGGGgGGGGG.",
  "..GGGGGGGGGG..",
  "....GGGGGG....",
  "......KK......",
  "......KK......",
  ".....KKK......",
  ".....KK.......",
  ".....KKk......",
  ".....KK.......",
  ".....KK.......",
  "....KKKK......",
  "...KKKKKK.....",
]);

export type Anim = "idle" | "walk" | "eat" | "hop" | "sad" | "punch" | "hit";

/** Two frames per animation. walk reuses idle frames (played faster). */
export const FRAMES: Record<Anim, [SpriteGrid, SpriteGrid]> = {
  idle: [IDLE1, IDLE2],
  walk: [IDLE1, IDLE2],
  eat: [EAT1, EAT2],
  hop: [HOP1, HOP2],
  sad: [SAD1, SAD2],
  punch: [PUNCH1, PUNCH2],
  hit: [HIT1, HIT2],
};

/** Base (unmirrored) width of a squirrel frame — used to align mirrored sprites. */
export const SPRITE_BASE_W = 14;

export type Palette = Record<string, string>;

export const PALETTES: Record<"rush" | "sage", Palette> = {
  rush: { B: "#e0392b", T: "#9c221c", L: "#fdf1e2", E: "#1c1410", W: "#fffdf5", F: "#7a1a15", A: "#b07a3c", a: "#6e4a22" },
  sage: { B: "#f59e1b", T: "#b06a10", L: "#fdf1e2", E: "#1c1410", W: "#fffdf5", F: "#8a5510", A: "#b07a3c", a: "#6e4a22" },
};

export const TREE_PALETTE: Palette = { G: "#4e9e57", g: "#357040", K: "#6b4a2f", k: "#523823" };

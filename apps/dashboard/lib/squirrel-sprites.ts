/**
 * Pixel-art squirrel sprites, defined as symmetric half-rows (left edge to
 * center column) and mirrored at render time — an original design, not
 * based on any existing character. Front-facing sitting pose so symmetry
 * does the heavy lifting: only 7 values per row need to be placed by hand,
 * the other 6 are a guaranteed mirror.
 *
 * Token legend:
 *  .  empty (transparent)
 *  T  tail
 *  A  ear
 *  H  head
 *  E  eye
 *  B  body
 *  P  paw
 *  O  belly patch
 *  F  foot
 */
export type PixelToken = "." | "T" | "A" | "H" | "E" | "B" | "P" | "O" | "F";

export type SpriteHalfRow = PixelToken[];

function mirrorRow(half: SpriteHalfRow): PixelToken[] {
  const mirrored = [...half].slice(0, -1).reverse();
  return [...half, ...mirrored];
}

export function buildSpriteGrid(halfRows: SpriteHalfRow[]): PixelToken[][] {
  return halfRows.map(mirrorRow);
}

/** Alert pose: ears up, tail poofed high behind the head, ready to move. */
export const AGGRESSIVE_IDLE: SpriteHalfRow[] = [
  [".", ".", "T", ".", ".", ".", "."],
  [".", "T", "T", ".", ".", ".", "."],
  ["T", "T", "T", ".", ".", ".", "."],
  ["T", "T", ".", ".", "A", ".", "."],
  [".", "T", ".", ".", "A", "A", "."],
  [".", ".", ".", "H", "H", "H", "H"],
  [".", ".", ".", "H", "E", "H", "H"],
  [".", ".", ".", "H", "H", "H", "H"],
  [".", ".", ".", ".", "H", "H", "H"],
  [".", ".", ".", "B", "P", "B", "B"],
  [".", ".", ".", "B", "P", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "B", "B", "B"],
  [".", ".", ".", ".", "F", ".", "."],
  [".", ".", ".", ".", "F", ".", "."],
  [".", ".", ".", ".", ".", ".", "."],
];

/** Alert frame: tail poofs even higher, ears fully perked — used when a signal fires. */
export const AGGRESSIVE_ALERT: SpriteHalfRow[] = [
  [".", "T", "T", ".", ".", ".", "."],
  ["T", "T", "T", ".", ".", ".", "."],
  ["T", "T", ".", ".", "A", ".", "."],
  ["T", "T", ".", ".", "A", "A", "."],
  [".", "T", ".", "H", "H", "H", "H"],
  [".", ".", ".", "H", "E", "H", "H"],
  [".", ".", ".", "H", "H", "H", "H"],
  [".", ".", ".", ".", "H", "H", "H"],
  [".", ".", ".", "B", "P", "B", "B"],
  [".", ".", ".", "B", "P", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "B", "B", "B"],
  [".", ".", ".", ".", "F", ".", "."],
  [".", ".", ".", ".", "F", ".", "."],
  [".", ".", ".", ".", ".", ".", "."],
  [".", ".", ".", ".", ".", ".", "."],
];

/** Sentinel pose: tail low and calm, ears neutral, upright and still. */
export const CONSERVATIVE_IDLE: SpriteHalfRow[] = [
  [".", ".", ".", ".", ".", ".", "."],
  [".", ".", ".", ".", ".", ".", "."],
  [".", "T", ".", ".", ".", ".", "."],
  ["T", "T", ".", ".", "A", ".", "."],
  [".", "T", ".", ".", "A", ".", "."],
  [".", ".", ".", "H", "H", "H", "H"],
  [".", ".", ".", "H", "E", "H", "H"],
  [".", ".", ".", "H", "H", "H", "H"],
  [".", ".", ".", ".", "H", "H", "H"],
  [".", ".", ".", "B", "P", "B", "B"],
  [".", ".", ".", "B", "P", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "B", "B", "B"],
  [".", ".", ".", "B", "B", "B", "."],
  [".", ".", ".", ".", "F", ".", "."],
  [".", ".", ".", ".", "F", ".", "."],
];

/** Alert frame: rises onto its feet, tail lifts slightly — still restrained compared to Aggressive. */
export const CONSERVATIVE_ALERT: SpriteHalfRow[] = [
  [".", ".", ".", ".", ".", ".", "."],
  [".", "T", ".", ".", ".", ".", "."],
  ["T", "T", ".", ".", "A", ".", "."],
  ["T", "T", ".", ".", "A", "A", "."],
  [".", "T", ".", "H", "H", "H", "H"],
  [".", ".", ".", "H", "E", "H", "H"],
  [".", ".", ".", "H", "H", "H", "H"],
  [".", ".", ".", ".", "H", "H", "H"],
  [".", ".", ".", "B", "P", "B", "B"],
  [".", ".", ".", "B", "P", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "O", "O", "B"],
  [".", ".", "B", "B", "B", "B", "B"],
  [".", ".", ".", "B", "B", "B", "."],
  [".", ".", ".", ".", "F", ".", "."],
  [".", ".", ".", ".", "F", ".", "."],
  [".", ".", ".", ".", ".", ".", "."],
];

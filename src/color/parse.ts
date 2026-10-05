import type { RGB } from "../types";

/** Accepts an RGB triple, `#rgb` or `#rrggbb`. */
export function toRGB(colour: RGB | string): RGB {
  if (typeof colour !== "string") return colour;

  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) throw new Error(`colourmush: cannot parse colour "${colour}"`);

  let hex = m[1]!;
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

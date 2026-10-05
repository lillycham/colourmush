import type { Lab, RGB } from "../types";

const toLinear = (c: number): number => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (x: number): number => {
  const c = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
  return c * 255;
};

const clamp255 = (x: number): number => Math.min(255, Math.max(0, x));

export function rgbToOklab([r, g, b]: RGB): Lab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Out-of-gamut results are clamped to 0-255. */
export function oklabToRgb([L, a, b]: Lab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    clamp255(fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp255(fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp255(fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

export const chroma = ([, a, b]: Lab): number => Math.hypot(a, b);

export const labDistance = (p: Lab, q: Lab): number =>
  Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

export function rgbToHex([r, g, b]: RGB): string {
  const h = (c: number) => Math.round(clamp255(c)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

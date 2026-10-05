import { describe, expect, it } from "vitest";
import { labDistance, rgbToOklab } from "../src/color/oklab";
import { kmeans } from "../src/extract/kmeans";
import { paletteFromPixels } from "../src/extract/palette";
import type { PixelData, RGB } from "../src/types";

/** Builds an image from horizontal runs of `[colour, pixelCount]`. */
function image(runs: Array<[RGB | [number, number, number, number], number]>): PixelData {
  const total = runs.reduce((s, [, n]) => s + n, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [c, n] of runs) {
    for (let k = 0; k < n; k++, i += 4) {
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = c.length === 4 ? c[3]! : 255;
    }
  }
  return { data, width: total, height: 1 };
}

const near = (a: RGB, b: RGB) => labDistance(rgbToOklab(a), rgbToOklab(b)) < 0.03;

describe("kmeans", () => {
  const pts = new Float32Array([0, 0, 0, 0.1, 0, 0, 5, 5, 5, 5, 5.1, 5]);

  it("separates two obvious clusters", () => {
    const { centroids, counts } = kmeans(pts, 2, 7);
    expect([...counts].sort()).toEqual([2, 2]);
    const xs = [centroids[0]!, centroids[3]!].sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0.05, 3);
    expect(xs[1]).toBeCloseTo(5, 3);
  });

  it("is deterministic for a seed", () => {
    expect(kmeans(pts, 2, 3)).toEqual(kmeans(pts, 2, 3));
  });

  it("clamps k to the number of points", () => {
    expect(kmeans(pts, 10).counts.length).toBe(4);
    expect(kmeans(new Float32Array(0), 3).counts.length).toBe(0);
  });
});

describe("paletteFromPixels", () => {
  const red: RGB = [220, 30, 40];
  const green: RGB = [30, 200, 80];
  const blue: RGB = [40, 60, 230];

  it("finds the three flat colours, most dominant first", () => {
    const { colours } = paletteFromPixels(image([[red, 300], [green, 200], [blue, 100]]), { count: 3 });
    expect(colours).toHaveLength(3);
    expect(near(colours[0]!, red)).toBe(true);
    expect(near(colours[1]!, green)).toBe(true);
    expect(near(colours[2]!, blue)).toBe(true);
  });

  it("always returns `count` colours, even from a flat image", () => {
    const { colours, hex } = paletteFromPixels(image([[red, 50]]));
    expect(colours).toHaveLength(5);
    expect(hex).toHaveLength(5);
    colours.forEach((c) => expect(near(c, red)).toBe(true));
  });

  it("ignores transparent pixels", () => {
    const { colours } = paletteFromPixels(image([[[0, 255, 0, 0], 500], [red, 20]]), { count: 2 });
    colours.forEach((c) => expect(near(c, red)).toBe(true));
  });

  it("falls back to grey for a fully transparent image", () => {
    const { colours } = paletteFromPixels(image([[[0, 0, 0, 0], 10]]), { count: 2 });
    expect(colours).toEqual([[128, 128, 128], [128, 128, 128]]);
  });

  it("prefers a vivid minority over a dominant muddy grey", () => {
    const grey: RGB = [120, 120, 120];
    const { colours } = paletteFromPixels(image([[grey, 300], [red, 200]]), { count: 2 });
    expect(near(colours[0]!, red)).toBe(true);
  });

  it("is deterministic", () => {
    const img = image([[red, 90], [green, 70], [blue, 50], [[250, 250, 20], 30]]);
    expect(paletteFromPixels(img)).toEqual(paletteFromPixels(img));
  });
});

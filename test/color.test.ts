import { describe, expect, it } from "vitest";
import { oklabToRgb, rgbToHex, rgbToOklab } from "../src/color/oklab";
import { toRGB } from "../src/color/parse";
import type { RGB } from "../src/types";

describe("oklab", () => {
  it("maps white and black to L = 1 and 0", () => {
    const [Lw, aw, bw] = rgbToOklab([255, 255, 255]);
    expect(Lw).toBeCloseTo(1, 4);
    expect(aw).toBeCloseTo(0, 3);
    expect(bw).toBeCloseTo(0, 3);
    expect(rgbToOklab([0, 0, 0])[0]).toBeCloseTo(0, 6);
  });

  it("matches the reference value for pure red", () => {
    const [L, a, b] = rgbToOklab([255, 0, 0]);
    expect(L).toBeCloseTo(0.62796, 4);
    expect(a).toBeCloseTo(0.22486, 4);
    expect(b).toBeCloseTo(0.12585, 4);
  });

  it("round-trips sRGB", () => {
    const samples: RGB[] = [
      [12, 200, 99],
      [250, 3, 130],
      [128, 128, 128],
      [0, 0, 255],
    ];
    for (const rgb of samples) {
      const back = oklabToRgb(rgbToOklab(rgb));
      back.forEach((c, i) => expect(c).toBeCloseTo(rgb[i]!, 1));
    }
  });
});

describe("colour parsing", () => {
  it("parses hex forms", () => {
    expect(toRGB("#ff8000")).toEqual([255, 128, 0]);
    expect(toRGB("#f80")).toEqual([255, 136, 0]);
    expect(toRGB("0a0b0c")).toEqual([10, 11, 12]);
  });

  it("passes RGB triples through and rejects junk", () => {
    expect(toRGB([1, 2, 3])).toEqual([1, 2, 3]);
    expect(() => toRGB("nope")).toThrow();
  });

  it("formats hex", () => {
    expect(rgbToHex([255, 128, 0])).toBe("#ff8000");
  });
});

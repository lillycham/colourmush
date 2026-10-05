import { chroma, labDistance, oklabToRgb, rgbToHex, rgbToOklab } from "../color/oklab";
import type { ImageSource, Lab, Palette, PixelData, RGB } from "../types";
import { kmeans } from "./kmeans";
import { toPixelData } from "./load";

export interface PaletteOptions {
  /** Number of colours to return. Default 5. */
  count?: number;
  /** Longest side, in pixels, the image is downscaled to before clustering. Default 64. */
  sampleSize?: number;
  /** Seed for k-means++ initialisation. Default 1. */
  seed?: number;
}

/** Pixels below this alpha are ignored. */
const MIN_ALPHA = 125;
/** Cluster more than we return, then drop near-duplicates. */
const OVERCLUSTER = 3;
/** Minimum OKLab distance between two picked colours. */
const MIN_SEPARATION = 0.06;
const FALLBACK: RGB = [128, 128, 128];

/** Favours populous clusters, and boosts vivid ones over muddy greys. */
const score = (population: number, lab: Lab): number =>
  population * (0.35 + Math.min(chroma(lab), 0.2) / 0.2);

/**
 * Synchronous core of `extractPalette`: clusters opaque pixels in OKLab and
 * picks the `count` best, well-separated cluster centres, most dominant first.
 * Always returns exactly `count` colours (repeating the best ones if the image has fewer).
 */
export function paletteFromPixels(img: PixelData, opts: PaletteOptions = {}): Palette {
  const { count = 5, seed = 1 } = opts;
  const { data } = img;

  const points = new Float32Array((data.length / 4) * 3);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < MIN_ALPHA) continue;
    const [L, a, b] = rgbToOklab([data[i]!, data[i + 1]!, data[i + 2]!]);
    points[n * 3] = L;
    points[n * 3 + 1] = a;
    points[n * 3 + 2] = b;
    n++;
  }

  const colours: RGB[] = [];
  if (n > 0) {
    const { centroids, counts } = kmeans(points.subarray(0, n * 3), count * OVERCLUSTER, seed);
    const clusters = Array.from(counts, (population, c) => {
      const lab: Lab = [centroids[c * 3]!, centroids[c * 3 + 1]!, centroids[c * 3 + 2]!];
      return { lab, population, score: score(population, lab) };
    })
      .filter((c) => c.population > 0)
      .sort((p, q) => q.score - p.score);

    const picked: typeof clusters = [];
    for (const c of clusters) {
      if (picked.length === count) break;
      if (picked.every((p) => labDistance(p.lab, c.lab) >= MIN_SEPARATION)) picked.push(c);
    }
    // Too few distinct colours: top up with the best leftovers.
    for (const c of clusters) {
      if (picked.length === count) break;
      if (!picked.includes(c)) picked.push(c);
    }
    for (const c of picked) colours.push(oklabToRgb(c.lab));
  }

  if (colours.length === 0) colours.push(FALLBACK);
  for (let i = 0; colours.length < count; i++) colours.push(colours[i % colours.length]!);

  return { colours, hex: colours.map(rgbToHex) };
}

/** Extracts the dominant colours of an image, most dominant first. Browser only. */
export async function extractPalette(src: ImageSource, opts: PaletteOptions = {}): Promise<Palette> {
  return paletteFromPixels(await toPixelData(src, opts.sampleSize ?? 64), opts);
}

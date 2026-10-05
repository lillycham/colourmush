export interface KMeansResult {
  /** `k * 3` values, one centroid per cluster. */
  centroids: Float32Array;
  /** Number of points assigned to each centroid. */
  counts: Uint32Array;
}

/** Small deterministic PRNG, so the same image always gives the same palette. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (p: Float32Array, i: number, c: Float32Array, j: number): number => {
  const dx = p[i]! - c[j]!;
  const dy = p[i + 1]! - c[j + 1]!;
  const dz = p[i + 2]! - c[j + 2]!;
  return dx * dx + dy * dy + dz * dz;
};

/**
 * Lloyd's k-means over 3D points (`points.length / 3` of them), seeded with k-means++.
 * Pure and deterministic for a given `seed`.
 */
export function kmeans(points: Float32Array, k: number, seed = 1, maxIter = 20): KMeansResult {
  const n = Math.floor(points.length / 3);
  k = Math.min(k, n);
  if (k <= 0) return { centroids: new Float32Array(0), counts: new Uint32Array(0) };

  const rand = mulberry32(seed);
  const centroids = new Float32Array(k * 3);

  // k-means++: each new centroid is drawn with probability proportional to the
  // squared distance to its nearest existing centroid.
  const nearest = new Float32Array(n).fill(Infinity);
  for (let c = 0; c < k; c++) {
    let pick = Math.floor(rand() * n);
    if (c > 0) {
      let total = 0;
      for (let i = 0; i < n; i++) total += nearest[i]!;
      if (total > 0) {
        let r = rand() * total;
        for (let i = 0; i < n; i++) {
          r -= nearest[i]!;
          if (r <= 0) {
            pick = i;
            break;
          }
        }
      }
    }
    centroids.set(points.subarray(pick * 3, pick * 3 + 3), c * 3);
    for (let i = 0; i < n; i++) {
      nearest[i] = Math.min(nearest[i]!, dist2(points, i * 3, centroids, c * 3));
    }
  }

  const assign = new Uint32Array(n);
  const counts = new Uint32Array(k);
  const sums = new Float64Array(k * 3);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = iter === 0;
    counts.fill(0);
    sums.fill(0);

    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(points, i * 3, centroids, c * 3);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) changed = true;
      assign[i] = best;
      counts[best]!++;
      sums[best * 3]! += points[i * 3]!;
      sums[best * 3 + 1]! += points[i * 3 + 1]!;
      sums[best * 3 + 2]! += points[i * 3 + 2]!;
    }

    if (!changed) break;

    for (let c = 0; c < k; c++) {
      const count = counts[c]!;
      if (count === 0) continue; // keep the old centroid for an empty cluster
      centroids[c * 3] = sums[c * 3]! / count;
      centroids[c * 3 + 1] = sums[c * 3 + 1]! / count;
      centroids[c * 3 + 2] = sums[c * 3 + 2]! / count;
    }
  }

  return { centroids, counts };
}

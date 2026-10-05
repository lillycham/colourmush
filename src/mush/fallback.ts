import { oklabToRgb } from "../color/oklab";
import type { Frame, Painter } from "./painter";

/** Canvas 2D approximation of the shader: five drifting soft radial gradients. */
export function createCanvasPainter(canvas: HTMLCanvasElement): Painter {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("colourmush: no rendering context available");

  return {
    draw({ time: t, lab, width, height, intensity }: Frame) {
      const rgb = Array.from({ length: 5 }, (_, i) =>
        oklabToRgb([lab[i * 3]!, lab[i * 3 + 1]! * 1.12, lab[i * 3 + 2]! * 1.12]),
      );
      const css = (i: number, a: number) => `rgba(${rgb[i]!.map(Math.round).join(",")},${a})`;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = css(0, 1);
      ctx.fillRect(0, 0, width, height);

      const reach = Math.max(width, height) * (0.55 + 0.15 * intensity);
      for (let i = 1; i < 5; i++) {
        const x = width * (0.5 + 0.42 * Math.sin(t * 0.13 * (1 + i * 0.31) + i * 2.1));
        const y = height * (0.5 + 0.4 * Math.cos(t * 0.17 * (1 + i * 0.23) + i * 1.3));
        const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
        g.addColorStop(0, css(i, 0.9));
        g.addColorStop(1, css(i, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }
    },
    destroy() {},
  };
}

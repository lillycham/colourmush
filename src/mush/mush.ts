import { rgbToOklab } from "../color/oklab";
import { toRGB } from "../color/parse";
import type { RGB } from "../types";
import { createCanvasPainter } from "./fallback";
import type { Painter } from "./painter";
import { createWebGLPainter } from "./webgl";

type ColourInput = RGB | string;

export interface MushOptions {
  /** Initial colours (hex strings or RGB triples). Fewer than five are repeated. */
  colours?: ColourInput[];
  /** Animation speed multiplier. Default 1. */
  speed?: number;
  /** How strongly the noise warps the colours, 0-2. Default 1. */
  intensity?: number;
  /** Film grain / dither strength, 0-0.2. Default 0.04. */
  grain?: number;
  /** Fraction of CSS pixels to render at. Lower is cheaper. Default 0.5. */
  renderScale?: number;
  /** Render a still frame when the user prefers reduced motion. Default true. */
  respectReducedMotion?: boolean;
}

export interface PaletteChangeOptions {
  /** Cross-fade duration in ms. Default 1200. 0 snaps. */
  transitionMs?: number;
}

const DEFAULT_COLOURS = ["#5b6ee1", "#e1578a", "#f2a65a", "#3fb8af", "#7a4fd0"];
/** Offset into the noise field used for still frames, picked because it looks pleasant. */
const STILL_TIME = 12;

const smoothstep = (x: number) => x * x * (3 - 2 * x);

function toLabArray(colours: ColourInput[]): Float32Array {
  if (colours.length === 0) throw new Error("colourmush: at least one colour is required");
  const out = new Float32Array(15);
  for (let i = 0; i < 5; i++) {
    out.set(rgbToOklab(toRGB(colours[i % colours.length]!)), i * 3);
  }
  return out;
}

/** Animated, Apple-Music-style colour mush rendered into a canvas that fills `container`. */
export class ColourMush {
  private canvas!: HTMLCanvasElement;
  private painter!: Painter;
  private readonly container: HTMLElement;

  private speed: number;
  private intensity: number;
  private grain: number;
  private readonly renderScale: number;
  private readonly respectReducedMotion: boolean;

  private lab: Float32Array;
  private from: Float32Array;
  private target: Float32Array;
  private fade = { start: 0, duration: 0 };

  private time = STILL_TIME;
  private lastFrame = 0;
  private raf = 0;
  private paused = false;
  private visible = true;
  private inView = true;
  private reducedMotion = false;
  private destroyed = false;

  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly motionQuery: MediaQueryList;

  constructor(container: HTMLElement, opts: MushOptions = {}) {
    this.container = container;
    this.speed = opts.speed ?? 1;
    this.intensity = opts.intensity ?? 1;
    this.grain = opts.grain ?? 0.04;
    this.renderScale = opts.renderScale ?? 0.5;
    this.respectReducedMotion = opts.respectReducedMotion ?? true;

    this.lab = toLabArray(opts.colours ?? DEFAULT_COLOURS);
    this.from = this.lab.slice();
    this.target = this.lab.slice();

    this.mountCanvas();

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.respectReducedMotion && this.motionQuery.matches;
    this.motionQuery.addEventListener("change", this.onMotionChange);

    document.addEventListener("visibilitychange", this.onVisibility);
    this.visible = !document.hidden;

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      // Resizing clears the canvas, so redraw now rather than waiting for the next frame.
      this.render(this.reducedMotion ? STILL_TIME : this.time);
    });
    this.resizeObserver.observe(container);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.inView = entries.some((e) => e.isIntersecting);
      this.update();
    });
    this.intersectionObserver.observe(container);

    this.resize();
    this.update();
  }

  /** Cross-fades to a new set of colours, e.g. when the track changes. */
  setPalette(colours: ColourInput[], { transitionMs = 1200 }: PaletteChangeOptions = {}): void {
    if (this.destroyed) return;
    this.from = this.lab.slice();
    this.target = toLabArray(colours);

    if (transitionMs <= 0 || !this.animating) {
      this.lab = this.target.slice();
      this.fade.duration = 0;
      this.drawStill();
    } else {
      this.fade = { start: performance.now(), duration: transitionMs };
    }
  }

  setOptions(opts: Pick<MushOptions, "speed" | "intensity" | "grain">): void {
    this.speed = opts.speed ?? this.speed;
    this.intensity = opts.intensity ?? this.intensity;
    this.grain = opts.grain ?? this.grain;
    this.drawStill();
  }

  pause(): void {
    this.paused = true;
    this.update();
  }

  resume(): void {
    this.paused = false;
    this.update();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.motionQuery.removeEventListener("change", this.onMotionChange);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.painter.destroy();
    this.canvas.remove();
  }

  private get animating(): boolean {
    return !this.paused && this.visible && this.inView && !this.reducedMotion && !this.destroyed;
  }

  private mountCanvas(): void {
    this.canvas?.remove();
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    canvas.setAttribute("aria-hidden", "true");
    this.container.prepend(canvas);
    this.canvas = canvas;

    try {
      this.painter = createWebGLPainter(canvas);
      canvas.addEventListener("webglcontextlost", this.onContextLost);
      canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    } catch {
      // A canvas that has handed out a WebGL context can't give a 2D one, so start fresh.
      const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      this.canvas = fresh;
      this.painter = createCanvasPainter(fresh);
    }
  }

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault(); // lets the browser restore the context
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private readonly onContextRestored = (): void => {
    this.painter.destroy();
    this.mountCanvas();
    this.resize();
    this.update();
  };

  private readonly onVisibility = (): void => {
    this.visible = !document.hidden;
    this.update();
  };

  private readonly onMotionChange = (): void => {
    this.reducedMotion = this.respectReducedMotion && this.motionQuery.matches;
    if (this.reducedMotion) this.lab = this.target.slice();
    this.update();
  };

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.container.clientWidth * dpr * this.renderScale));
    const h = Math.max(1, Math.round(this.container.clientHeight * dpr * this.renderScale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Starts or stops the loop to match the current state, drawing one frame either way. */
  private update(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.animating) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.drawStill();
    }
  }

  private drawStill(): void {
    if (this.animating) return; // the loop will pick the change up on its next frame
    this.render(this.reducedMotion ? STILL_TIME : this.time);
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.time += dt * this.speed;

    if (this.fade.duration > 0) {
      const k = Math.min((now - this.fade.start) / this.fade.duration, 1);
      const e = smoothstep(k);
      for (let i = 0; i < 15; i++) {
        this.lab[i] = this.from[i]! + (this.target[i]! - this.from[i]!) * e;
      }
      if (k >= 1) this.fade.duration = 0;
    }

    this.render(this.time);
    this.raf = requestAnimationFrame(this.tick);
  };

  private render(time: number): void {
    this.painter.draw({
      time,
      lab: this.lab,
      width: this.canvas.width,
      height: this.canvas.height,
      intensity: this.intensity,
      grain: this.grain,
    });
  }
}

import type { ImageSource, PixelData } from "../types";

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function createSurface(w: number, h: number): Surface {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

async function decode(src: ImageSource): Promise<CanvasImageSource> {
  if (typeof src === "string") {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed to read pixels back from cross-origin art
    img.decoding = "async";
    img.src = src;
    await img.decode();
    return img;
  }
  if (src instanceof Blob) return createImageBitmap(src);
  if (src instanceof HTMLImageElement && !src.complete) await src.decode();
  return src;
}

const sizeOf = (s: CanvasImageSource): [number, number] => {
  if (s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight];
  if (s instanceof HTMLVideoElement) return [s.videoWidth, s.videoHeight];
  const { width, height } = s as { width: number; height: number };
  return [width, height];
};

/** Decodes any supported source and downscales it so the longest side is at most `sampleSize`. */
export async function toPixelData(src: ImageSource, sampleSize: number): Promise<PixelData> {
  const image = await decode(src);
  const [w, h] = sizeOf(image);
  if (!w || !h) throw new Error("colourmush: image has no pixels");

  const scale = Math.min(1, sampleSize / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const surface = createSurface(tw, th);
  const ctx = surface.getContext("2d", { willReadFrequently: true }) as Ctx | null;
  if (!ctx) throw new Error("colourmush: 2D canvas is unavailable");
  ctx.drawImage(image, 0, 0, tw, th);
  return ctx.getImageData(0, 0, tw, th);
}

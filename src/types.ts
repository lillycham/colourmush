/** sRGB colour, each channel 0-255. */
export type RGB = readonly [r: number, g: number, b: number];

/** OKLab colour: lightness 0-1, a and b roughly -0.4 to 0.4. */
export type Lab = readonly [L: number, a: number, b: number];

/** Anything the extractor can read pixels from. */
export type ImageSource =
  | string
  | Blob
  | HTMLImageElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap;

/** Minimal shape shared with the DOM `ImageData`, so extraction is testable in Node. */
export interface PixelData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface Palette {
  /** Colours sorted by dominance, most dominant first. */
  colours: RGB[];
  hex: string[];
}

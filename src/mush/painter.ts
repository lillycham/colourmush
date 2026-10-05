/** What a painter needs to draw one frame. */
export interface Frame {
  /** Animation time in seconds (already scaled by speed). */
  time: number;
  /** Five OKLab triples, flattened (15 values). */
  lab: Float32Array;
  width: number;
  height: number;
  intensity: number;
  grain: number;
}

export interface Painter {
  draw(frame: Frame): void;
  destroy(): void;
}

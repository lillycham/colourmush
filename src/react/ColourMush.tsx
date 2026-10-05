import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { extractPalette } from "../extract/palette";
import { ColourMush as Mush, type MushOptions } from "../mush/mush";
import type { ImageSource, Palette, RGB } from "../types";

export interface ColourMushProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children">,
    Pick<MushOptions, "speed" | "intensity" | "grain" | "renderScale" | "respectReducedMotion"> {
  /** Extract the palette from this image. Ignored while `colours` is set. */
  image?: ImageSource;
  /** Use these colours directly instead of extracting from `image`. */
  colours?: Array<RGB | string>;
  /** Cross-fade duration when the palette changes, in ms. */
  transitionMs?: number;
  /** Called with the extracted palette whenever `image` changes. */
  onPalette?: (palette: Palette) => void;
}

const BASE: CSSProperties = { position: "relative", overflow: "hidden" };

export const ColourMush = forwardRef<HTMLDivElement, ColourMushProps>(function ColourMush(
  {
    image,
    colours,
    transitionMs,
    onPalette,
    speed,
    intensity,
    grain,
    renderScale,
    respectReducedMotion,
    style,
    ...divProps
  },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const mush = useRef<Mush | null>(null);
  const firstPalette = useRef(true);
  const onPaletteRef = useRef(onPalette);
  onPaletteRef.current = onPalette;

  useImperativeHandle(ref, () => el.current!, []);

  // Create once; later prop changes go through setOptions / setPalette.
  useEffect(() => {
    const m = new Mush(el.current!, { colours, speed, intensity, grain, renderScale, respectReducedMotion });
    mush.current = m;
    return () => {
      m.destroy();
      mush.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderScale, respectReducedMotion]);

  useEffect(() => {
    mush.current?.setOptions({ speed, intensity, grain });
  }, [speed, intensity, grain]);

  const coloursKey = colours?.map((c) => (typeof c === "string" ? c : c.join(","))).join("|");
  useEffect(() => {
    if (!colours) return;
    mush.current?.setPalette(colours, { transitionMs: firstPalette.current ? 0 : transitionMs });
    firstPalette.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coloursKey, transitionMs]);

  useEffect(() => {
    if (colours || image === undefined) return;
    let stale = false;
    extractPalette(image)
      .then((palette) => {
        if (stale) return;
        mush.current?.setPalette(palette.colours, { transitionMs: firstPalette.current ? 0 : transitionMs });
        firstPalette.current = false;
        onPaletteRef.current?.(palette);
      })
      .catch((err) => console.error(err));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, coloursKey]);

  return <div ref={el} style={{ ...BASE, ...style }} {...divProps} />;
});

# colourmush

Pull the five dominant colours out of an image, then render them as a slow, liquid
"colour mush" background, like the full-screen player in Apple Music.

- Palette extraction: k-means++ in OKLab, ranked by population and vividness.
- Rendering: a WebGL shader (domain-warped noise, OKLab blending), with a Canvas 2D fallback.
- No runtime dependencies. Browser only. React wrapper included.

## Usage

```ts
import { ColourMush, extractPalette } from "colourmush";

const palette = await extractPalette("/cover.jpg"); // URL, Blob, <img>, canvas or ImageBitmap
// palette.colours: RGB[] (5, most dominant first), palette.hex: string[]

const mush = new ColourMush(document.getElementById("bg")!); // container needs a size
mush.setPalette(palette.colours); // cross-fades

mush.setOptions({ speed: 1, intensity: 1, grain: 0.04 });
mush.pause();
mush.resume();
mush.destroy();
```

The canvas is absolutely positioned, so the container should be `position: relative` (or fixed or absolute).

Cross-origin images need CORS headers, or the browser blocks reading their pixels.

### React

```tsx
import { ColourMush } from "colourmush/react";

<ColourMush image={coverUrl} style={{ position: "fixed", inset: 0 }} />
<ColourMush colours={["#2b1055", "#7597de", "#f9748f"]} speed={0.6} />
```

## Behaviour

- Animation pauses when the tab is hidden or the element is off screen.
- With `prefers-reduced-motion`, it draws a still frame (disable with `respectReducedMotion: false`).
- It renders at half resolution by default (`renderScale`), because the image is smooth.
- WebGL context loss is handled.

## Development

Tools come from the Nix flake.

```sh
nix develop -c pnpm install
nix develop -c pnpm test
nix develop -c pnpm build
nix develop -c pnpm demo         # demo site on http://localhost:5173
nix develop -c pnpm demo:build   # static site in demo/dist
```

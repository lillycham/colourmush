import { ColourMush, extractPalette } from "../src";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const mush = new ColourMush($("mush"));
const art = $<HTMLCanvasElement>("art");
const artCtx = art.getContext("2d")!;
const swatches = $("swatches");

/** Procedural covers, so the demo needs no image files. */
const COVERS: Array<{ name: string; colours: string[] }> = [
  { name: "Sunset", colours: ["#2b1055", "#7597de", "#f9748f", "#fdb97d", "#fde9a9"] },
  { name: "Forest", colours: ["#0b3d2e", "#1f7a4d", "#8fc93a", "#f2e96b", "#14281d"] },
  { name: "Neon", colours: ["#10002b", "#7b2cbf", "#ff2e93", "#00f5d4", "#3a0ca3"] },
  { name: "Ocean", colours: ["#03045e", "#0077b6", "#00b4d8", "#caf0f8", "#ff9e6d"] },
];

function drawCover(colours: string[], seed: number): void {
  const w = art.width;
  const g = artCtx.createLinearGradient(0, 0, w, w);
  g.addColorStop(0, colours[0]!);
  g.addColorStop(1, colours[1]!);
  artCtx.fillStyle = g;
  artCtx.fillRect(0, 0, w, w);

  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 2; i < colours.length; i++) {
    for (let k = 0; k < 2; k++) {
      artCtx.beginPath();
      artCtx.arc(rand() * w, rand() * w, w * (0.14 + rand() * 0.22), 0, Math.PI * 2);
      artCtx.fillStyle = colours[i]!;
      artCtx.globalAlpha = 0.85;
      artCtx.fill();
    }
  }
  artCtx.globalAlpha = 1;
}

async function applyArtwork(): Promise<void> {
  try {
    const palette = await extractPalette(art);
    mush.setPalette(palette.colours);
    swatches.replaceChildren(
      ...palette.hex.map((hex) => {
        const li = document.createElement("li");
        li.style.background = hex;
        li.title = hex;
        return li;
      }),
    );
  } catch (err) {
    console.error(err);
  }
}

async function showImage(blob: Blob): Promise<void> {
  const bmp = await createImageBitmap(blob);
  // Cover-fit into the square canvas.
  const side = Math.min(bmp.width, bmp.height);
  artCtx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, art.width, art.height);
  bmp.close();
  await applyArtwork();
}

// Sample buttons
COVERS.forEach(({ name, colours }, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = name;
  b.addEventListener("click", () => {
    drawCover(colours, i + 3);
    void applyArtwork();
  });
  $("samples").append(b);
});

// Uploads: picker, drag and drop, paste
$<HTMLInputElement>("file").addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) void showImage(file);
});

const stage = $("drop");
window.addEventListener("dragover", (e) => {
  e.preventDefault();
  stage.classList.add("dragging");
});
window.addEventListener("dragleave", (e) => {
  if (e.relatedTarget === null) stage.classList.remove("dragging");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  stage.classList.remove("dragging");
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
  if (file) void showImage(file);
});
window.addEventListener("paste", (e) => {
  const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
  if (file) void showImage(file);
});

// Controls
const bind = (id: "speed" | "intensity" | "grain") =>
  $<HTMLInputElement>(id).addEventListener("input", (e) =>
    mush.setOptions({ [id]: Number((e.target as HTMLInputElement).value) }),
  );
(["speed", "intensity", "grain"] as const).forEach(bind);

let paused = false;
$("pause").addEventListener("click", (e) => {
  paused = !paused;
  if (paused) mush.pause();
  else mush.resume();
  (e.target as HTMLButtonElement).textContent = paused ? "Resume" : "Pause";
});

drawCover(COVERS[0]!.colours, 3);
void applyArtwork();

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { RenderInput } from "takumi-js";
import { googleFonts } from "takumi-js/helpers";
import { ImageResponse, type ImageResponseOptions } from "takumi-js/response";

export const REPO_ROOT = join(import.meta.dirname, "../../");
export const DEVICE_PIXEL_RATIO = 2.5;

export const renderToFile = async (component: RenderInput, options: ImageResponseOptions, outputPath: string) => {
  const response = new ImageResponse(component, options);
  const arrayBuffer = await response.arrayBuffer();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(arrayBuffer));
};

export const readImage = async (imagePath: string) => ({
  src: `image:${imagePath}`,
  data: () => readFile(imagePath),
});

export const scaledDimensions = (
  width: number,
  height: number,
): Pick<ImageResponseOptions, "width" | "height" | "devicePixelRatio"> => ({
  width: width * DEVICE_PIXEL_RATIO,
  height: height * DEVICE_PIXEL_RATIO,
  devicePixelRatio: DEVICE_PIXEL_RATIO,
});

/** sRGB renderings of the palette in `@blankparticle/ui/setup` (packages/ui/src/styles/styles.css) */
export const themedInk = {
  paper: "#fbfaf6",
  text: "#1d1b28",
  muted: "#525060",
  violet: "#623bab",
  orange: "#ea6f2f",
  orangeDeep: "#b13e06",
  highlight: "#ddf092",
};

/** The design system's body and display faces */
export const fonts = await googleFonts([
  { name: "Figtree", weight: [400, 700], style: "normal" },
  { name: "Plus Jakarta Sans", weight: [800], style: "normal" },
]);

export const profileImage = await readImage(join(REPO_ROOT, "apps/www/public/me.png"));

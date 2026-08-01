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

export const themedInk = {
  paper: "#f8f9f5",
  text: "#292333",
  muted: "#5a5467",
  violet: "#682dac",
  orange: "#f3680f",
  orangeDeep: "#ae3200",
  lime: "#ccf77a",
};

export const fonts = await googleFonts([
  { name: "Karla", weight: [400, 700], style: "normal" },
  { name: "Bricolage Grotesque", weight: [800], style: "normal" },
]);

export const profileImage = await readImage(join(REPO_ROOT, "apps/www/public/me.png"));

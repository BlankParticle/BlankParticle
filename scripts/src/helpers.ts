import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RenderInput } from "takumi-js";
import { ImageResponse, type ImageResponseOptions } from "takumi-js/response";

export const REPO_ROOT = join(import.meta.dirname, "../../");
export const DEVICE_PIXEL_RATIO = 2.5;

export const renderToFile = async (component: RenderInput, options: ImageResponseOptions, outputPath: string) => {
  const response = new ImageResponse(component, options);
  const arrayBuffer = await response.arrayBuffer();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(arrayBuffer));
};

export const readFontData = async (fontPackage: string, filePath: string) => {
  const fontPackageEntry = fileURLToPath(import.meta.resolve(fontPackage, import.meta.url));
  const fontPath = join(dirname(fontPackageEntry), filePath);
  const fontData = await readFile(fontPath);
  return fontData;
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

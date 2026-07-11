import { join } from "node:path";

import { readFontData, readImage, REPO_ROOT } from "./helpers.ts";

export const themedInk = {
  paper: "#f8f9f5",
  text: "#292333",
  muted: "#5a5467",
  violet: "#682dac",
  orange: "#f3680f",
  orangeDeep: "#ae3200",
  lime: "#ccf77a",
};

export const fonts = [
  {
    name: "Bricolage Grotesque",
    data: await readFontData("@fontsource/bricolage-grotesque", "files/bricolage-grotesque-latin-800-normal.woff2"),
    style: "normal" as const,
    weight: 800,
  },
  {
    name: "Karla",
    data: await readFontData("@fontsource/karla", "files/karla-latin-400-normal.woff2"),
    style: "normal" as const,
    weight: 400,
  },
  {
    name: "Karla",
    data: await readFontData("@fontsource/karla", "files/karla-latin-700-normal.woff2"),
    style: "normal" as const,
    weight: 700,
  },
];

export const profileImage = await readImage(join(REPO_ROOT, "apps/www/public/me.png"));

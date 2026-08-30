import type { UserConfig } from "vite";

export const viteDefaults = {
  server: { allowedHosts: [".blankparticle.com"] },
  clearScreen: false,
} satisfies UserConfig;

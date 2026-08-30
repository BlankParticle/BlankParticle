import type { UserConfig } from "vite";

export const viteDefaults = {
  server: { allowedHosts: [".blankparticle.com"] },
  resolve: { tsconfigPaths: true },
  clearScreen: false,
} satisfies UserConfig;

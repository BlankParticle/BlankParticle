import { tailwindcss } from "@blankparticle/ui/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  ssr: { noExternal: ["@distilled.cloud/cloudflare", "@distilled.cloud/core", "effect"] },
  server: { allowedHosts: [".blankparticle.com"] },
  resolve: { tsconfigPaths: true },
  clearScreen: false,
});

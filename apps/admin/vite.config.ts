import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  // workerd's module fallback can't resolve these through their exports maps in dev
  ssr: { noExternal: ["@distilled.cloud/cloudflare", "@distilled.cloud/core", "effect"] },
  server: { allowedHosts: [".blankparticle.com"] },
  resolve: { tsconfigPaths: true },
  clearScreen: false,
});

import { tailwindcss } from "@blankparticle/ui/vite-plugin";
import { viteDefaults } from "@blankparticle/utils/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  ...viteDefaults,
  plugins: [tailwindcss(), tanstackStart(), viteReact({ compiler: true })],
});

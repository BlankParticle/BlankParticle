import tailwindcss from "@blankparticle/ui/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [mdx(), tailwindcss(), tanstackStart({ rsc: { enabled: true } }), rsc(), viteReact()],
  define: {
    "import.meta.env.VITE_GIT_HASH": JSON.stringify(process.env.GITHUB_CI_COMMIT_SHA?.slice(0, 7) ?? "development"),
  },
  server: { allowedHosts: [".blankparticle.com"] },
  resolve: { tsconfigPaths: true },
  clearScreen: false,
});

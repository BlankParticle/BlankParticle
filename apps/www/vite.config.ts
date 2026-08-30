import { tailwindcss } from "@blankparticle/ui/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";

const uiServerDeps = [
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "@phosphor-icons/react",
  "lucide-react",
].map((dep) => `@blankparticle/ui > ${dep}`);

export default defineConfig({
  plugins: [mdx(), tailwindcss(), tanstackStart(), viteReact()],
  environments: {
    ssr: { optimizeDeps: { include: uiServerDeps } },
  },
  define: {
    "import.meta.env.VITE_GIT_HASH": JSON.stringify(process.env.GITHUB_CI_COMMIT_SHA?.slice(0, 7) ?? "development"),
  },
  server: { allowedHosts: [".blankparticle.com"] },
  resolve: { tsconfigPaths: true },
  clearScreen: false,
});

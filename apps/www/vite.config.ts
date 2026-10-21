import { tailwindcss } from "@blankparticle/ui/vite-plugin";
import { viteDefaults } from "@blankparticle/utils/vite";
import { createThemeCss } from "@tanstack/highlight/theme";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  ...viteDefaults,
  define: {
    // GitHub Actions sets GITHUB_SHA; the footer links the commit a build came from
    "import.meta.env.VITE_GIT_HASH": JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "development"),
    // generated here so @tanstack/highlight stays out of the client bundle
    "import.meta.env.HIGHLIGHT_THEME_CSS": JSON.stringify(createThemeCss({ light: githubLightTheme })),
  },
  plugins: [mdx(), tailwindcss(), tanstackStart(), viteReact({ compiler: true })],
});

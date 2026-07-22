import { cloudflare } from "@cloudflare/vite-plugin";
import contentCollections from "@content-collections/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const TARGET_DOMAIN = "blankparticle.com";
const BLOG_DOMAINS = ["blog.blankparticle.in", "blog.blankparticle.com"];
const EXTRA_DOMAINS = ["www.blankparticle.com", "blankparticle.in", "www.blankparticle.in", "rx2.dev"];

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      config: {
        name: "www",
        compatibility_date: "2026-07-11",
        compatibility_flags: ["nodejs_compat"],
        main: "src/worker.ts",
        routes: [TARGET_DOMAIN, ...EXTRA_DOMAINS, ...BLOG_DOMAINS].map((pattern) => ({ custom_domain: true, pattern })),
        vars: {
          TARGET_DOMAIN,
          BLOG_DOMAINS,
        },
        observability: {
          enabled: true,
        },
      },
    }),
    contentCollections(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  define: {
    "import.meta.env.VITE_GIT_HASH": JSON.stringify(process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7) ?? "development"),
  },
  server: { allowedHosts: ["anna"] },
  resolve: { tsconfigPaths: true },
  clearScreen: false,
});

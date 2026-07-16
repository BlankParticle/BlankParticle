import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      config: {
        name: "www",
        compatibility_date: "2026-07-11",
        compatibility_flags: ["nodejs_compat"],
        main: "src/worker.ts",
        routes: [
          "blankparticle.com",
          "www.blankparticle.com",
          "blankparticle.in",
          "www.blankparticle.in",
          "rx2.dev",
          "blog.blankparticle.in",
          "blog.blankparticle.com",
        ].map((pattern) => ({ custom_domain: true, pattern })),
        vars: {
          TARGET_DOMAIN: "blankparticle.com",
        },
        observability: {
          enabled: true,
        },
      },
    }),
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

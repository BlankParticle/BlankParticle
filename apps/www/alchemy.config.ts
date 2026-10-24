import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Namespace from "alchemy/Namespace";
import * as RemovalPolicy from "alchemy/RemovalPolicy";

const TARGET_DOMAIN = "blankparticle.com";
const BLOG_DOMAINS = ["blog.blankparticle.in", "blog.blankparticle.com"];
const EXTRA_DOMAINS = ["www.blankparticle.com", "blankparticle.in", "www.blankparticle.in", "rx2.dev", "www.rx2.dev"];

const STABLE_ASSET = "public, max-age=86400, stale-while-revalidate=604800";

// `_headers` rules for the asset layer; they apply to files served from the client build, not to Worker responses
const ASSET_HEADERS = [
  // hashed by Vite, so a changed file gets a new name
  "/assets/*\n  Cache-Control: public, max-age=31536000, immutable",
  // stable names that rarely change
  ...["/images/*", "/og-image.jpg", "/me.png", "/favicon.ico", "/apple-touch-icon.png"].map(
    (path) => `${path}\n  Cache-Control: ${STABLE_ASSET}`,
  ),
].join("\n");

export const WwwApp = Cloudflare.Website.Vite("Worker", {
  rootDir: import.meta.dirname,
  name: "www",
  main: "src/worker.ts",
  env: {
    TARGET_DOMAIN,
    BLOG_DOMAINS,
    EXTRA_DOMAINS,
  },
  assets: { headers: ASSET_HEADERS },
  domain: { name: TARGET_DOMAIN, aliases: [...BLOG_DOMAINS, ...EXTRA_DOMAINS] },
  dev: { port: 9002 },
  workersDev: false,
});

export type WwwAppEnv = Cloudflare.InferEnv<typeof WwwApp>;

export const SetupWwwApp = WwwApp.pipe(RemovalPolicy.retain(), Namespace.push("Www"));

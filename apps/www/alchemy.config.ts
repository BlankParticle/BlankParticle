import * as Cloudflare from "alchemy/Cloudflare";
import * as Namespace from "alchemy/Namespace";
import * as RemovalPolicy from "alchemy/RemovalPolicy";

const TARGET_DOMAIN = "blankparticle.com";
const BLOG_DOMAINS = ["blog.blankparticle.in", "blog.blankparticle.com"];
const EXTRA_DOMAINS = ["www.blankparticle.com", "blankparticle.in", "www.blankparticle.in", "rx2.dev", "www.rx2.dev"];

export const WwwApp = Cloudflare.Website.Vite("Worker", {
  rootDir: import.meta.dirname,
  name: "www",
  main: "src/worker.ts",
  env: {
    TARGET_DOMAIN,
    BLOG_DOMAINS,
    EXTRA_DOMAINS,
    VITE_GIT_HASH: process.env.GITHUB_CI_COMMIT_SHA?.slice(0, 7) ?? "development",
  },
  compatibility: { flags: ["nodejs_compat"] },
  domain: { name: TARGET_DOMAIN, aliases: [...BLOG_DOMAINS, ...EXTRA_DOMAINS] },
  dev: { port: 9002 },
  workersDev: false,
});

export type WwwAppEnv = Cloudflare.InferEnv<typeof WwwApp>;

export const SetupWwwApp = WwwApp.pipe(RemovalPolicy.retain(), Namespace.push("Www"));

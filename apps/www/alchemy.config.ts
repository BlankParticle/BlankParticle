import * as Cloudflare from "alchemy/Cloudflare";

const TARGET_DOMAIN = "blankparticle.com";
const BLOG_DOMAINS = ["blog.blankparticle.in", "blog.blankparticle.com"];
const EXTRA_DOMAINS = ["www.blankparticle.com", "blankparticle.in", "www.blankparticle.in", "rx2.dev", "www.rx2.dev"];

export class MainWebsite extends Cloudflare.Website.Vite<MainWebsite>()("www", {
  rootDir: import.meta.dirname,
  name: "www",
  main: "src/worker.ts",
  env: { TARGET_DOMAIN, BLOG_DOMAINS, EXTRA_DOMAINS },
  compatibility: { flags: ["nodejs_compat"] },
  viteEnvironments: { entry: "ssr", children: ["rsc"] },
  domain: { name: TARGET_DOMAIN, aliases: [...BLOG_DOMAINS, ...EXTRA_DOMAINS] },
  dev: { port: 5173 },
  workersDev: false,
}) {}

export type MainWebsiteEnv = Cloudflare.InferEnv<typeof MainWebsite>;

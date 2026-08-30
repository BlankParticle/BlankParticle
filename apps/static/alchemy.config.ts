import { join } from "node:path";

import * as Cloudflare from "alchemy/Cloudflare";
import * as Namespace from "alchemy/Namespace";
import * as RemovalPolicy from "alchemy/RemovalPolicy";

export const StaticAssetsWorker = Cloudflare.Worker("Worker", {
  name: "static",
  assets: { directory: join(import.meta.dirname, "public"), htmlHandling: "drop-trailing-slash" },
  domain: { name: "static.blankparticle.com", aliases: ["static.rx2.dev"] },
  workersDev: false,
  dev: { port: 9004 },
});

export const SetupStaticAssetsWorker = StaticAssetsWorker.pipe(RemovalPolicy.retain(), Namespace.push("Static"));

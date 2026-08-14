import { join } from "node:path";

import * as Cloudflare from "alchemy/Cloudflare";

export class StaticAssetsWorker extends Cloudflare.Worker<StaticAssetsWorker>()("static", {
  name: "static",
  assets: { directory: join(import.meta.dirname, "public"), htmlHandling: "drop-trailing-slash" },
  domain: { name: "static.blankparticle.com", aliases: ["static.rx2.dev"] },
  workersDev: false,
}) {}

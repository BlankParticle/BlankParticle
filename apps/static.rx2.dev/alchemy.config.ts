import { join } from "node:path";

import * as Cloudflare from "alchemy/Cloudflare";

const TARGET_DOMAIN = "static.rx2.dev";

export class StaticAssetsWorker extends Cloudflare.Worker<StaticAssetsWorker>()(TARGET_DOMAIN, {
  name: "static-rx2-dev",
  assets: {
    directory: join(import.meta.dirname, "public"),
    htmlHandling: "drop-trailing-slash",
  },
  workersDev: false,
  domain: { name: TARGET_DOMAIN },
}) {}

import { join } from "node:path";

import * as Cloudflare from "alchemy/Cloudflare";

const TARGET_DOMAIN = "static.rx2.dev";

export const StaticAssetsWorker = Cloudflare.Worker(TARGET_DOMAIN, {
  name: "static-rx2-dev",
  assets: {
    directory: join(import.meta.dirname, "public"),
    htmlHandling: "drop-trailing-slash",
  },
  domain: [TARGET_DOMAIN],
  url: false,
});

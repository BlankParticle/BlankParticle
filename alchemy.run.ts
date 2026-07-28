import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { StaticAssetsWorker } from "./apps/static.rx2.dev/spec.ts";
import { MainWebsite } from "./apps/www/spec.ts";

export default Alchemy.Stack(
  "BlankParticle",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const mainWebsite = yield* MainWebsite;
    const staticAssetWorker = yield* StaticAssetsWorker;
    return { mainWebsite, staticAssetWorker };
  }),
);

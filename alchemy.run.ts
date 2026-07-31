import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { SetupAdminApp } from "./apps/admin/alchemy.config.ts";
import { StaticAssetsWorker } from "./apps/static.rx2.dev/alchemy.config.ts";
import { MainWebsite } from "./apps/www/alchemy.config.ts";

export default Alchemy.Stack(
  "BlankParticle",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const mainWebsite = yield* MainWebsite;
    const staticAssetWorker = yield* StaticAssetsWorker;
    const adminApp = yield* SetupAdminApp;
    return { mainWebsite, staticAssetWorker, adminApp };
  }),
).pipe(adopt());

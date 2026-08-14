import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { SetupAdminApp } from "./apps/admin/alchemy.config.ts";
import { StaticAssetsWorker } from "./apps/static/alchemy.config.ts";
import { MainWebsite } from "./apps/www/alchemy.config.ts";

export default Alchemy.Stack(
  "BlankParticle",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.all([MainWebsite, SetupAdminApp, StaticAssetsWorker]),
);

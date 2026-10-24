import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Drizzle from "@alchemy.run/drizzle";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SetupAuthApp } from "./apps/auth/alchemy.config.ts";
import { SetupToolsApp } from "./apps/tools/alchemy.config.ts";
import { SetupWwwApp } from "./apps/www/alchemy.config.ts";

export default Alchemy.Stack(
  "BlankParticle",
  { providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers()), state: Cloudflare.state() },
  Effect.all([SetupAuthApp, SetupWwwApp, SetupToolsApp]),
);

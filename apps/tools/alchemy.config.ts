import { join } from "node:path";

import { CloudflareAccountEmail, CloudflareAccountId } from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Namespace from "alchemy/Namespace";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Option } from "effect";
import * as Effect from "effect/Effect";

const ROOT_DOMAIN = "blankparticle.com";
const ORIGINS = {
  tools: `tools.${ROOT_DOMAIN}`,
  sites: `sites.${ROOT_DOMAIN}`,
  files: `files.${ROOT_DOMAIN}`,
  email: `email.${ROOT_DOMAIN}`,
};

const KV = Cloudflare.KV.Namespace("KV", { title: "tools-kv" }).pipe(RemovalPolicy.retain());

const Bucket = Cloudflare.R2.Bucket("Bucket", { name: "tools-bucket" }).pipe(RemovalPolicy.retain());

const Schema = Drizzle.Schema("Schema", {
  schema: join(import.meta.dirname, "src/db/schema.ts"),
  out: join(import.meta.dirname, "migrations"),
  dialect: "sqlite",
});

const DB = Effect.flatMap(Schema, (schema) =>
  Cloudflare.D1.Database("DB", { name: "tools-db", migrations: schema }).pipe(RemovalPolicy.retain()),
);

const EmailApiToken = Effect.gen(function* () {
  const accountId = yield* CloudflareAccountId;
  const stage = yield* Alchemy.Stage;

  const token =
    stage === "prod"
      ? yield* Cloudflare.ApiToken.AccountApiToken("CloudflareAppToken", {
          accountId,
          name: "App Token (BlankParticle/BlankParticle/Tools)",
          policies: [
            {
              effect: "allow",
              permissionGroups: ["Email Routing Addresses Read", "Email Routing Addresses Write"],
              resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
            },
            {
              effect: "allow",
              // Zone Settings Read is required by GET /zones/:id/email/routing (the settings endpoint)
              permissionGroups: [
                "Zone Read",
                "Zone Settings Read",
                "Email Routing Rules Read",
                "Email Routing Rules Write",
              ],
              resources: {
                [`com.cloudflare.api.account.${accountId}`]: {
                  "com.cloudflare.api.account.zone.*": "*",
                },
              },
            },
          ],
        })
      : yield* Cloudflare.ApiToken.AccountApiToken.ref("Tools/CloudflareAppToken", { stage: "prod" });

  return token.value;
});

export const ToolsApp = Cloudflare.Website.Vite("Worker", {
  rootDir: import.meta.dirname,
  name: "tools",
  main: "src/worker.ts",
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    KV: KV,
    DB: DB,
    FILES: Bucket,
    CF_API_TOKEN: EmailApiToken,
    CF_ACCOUNT_ID: CloudflareAccountId,
    AUTH_ORIGIN: Alchemy.ALCHEMY_DEV.pipe(
      Effect.map((dev) => (dev ? `http://localhost:9001` : `https://auth.${ROOT_DOMAIN}`)),
    ),
    OWNER_EMAIL: CloudflareAccountEmail,
    ROOT_DOMAIN,
    ORIGINS,
  },
  domain: { name: ORIGINS.tools, aliases: [ORIGINS.sites, ORIGINS.files, ORIGINS.email] },
  routes: [{ pattern: `*.${ORIGINS.sites}/*`, zoneName: ROOT_DOMAIN }],
  crons: ["0 3 * * *"],
  workersDev: false,
  dev: { port: 9003 },
});

export type ToolsAppEnv = Cloudflare.InferEnv<typeof ToolsApp>;

const SetupZones = Effect.fn(function* (app: Cloudflare.Worker) {
  if (yield* Alchemy.ALCHEMY_DEV) return; // No need to even reference these in dev

  const accountId = yield* CloudflareAccountId;
  const zones = yield* Cloudflare.Zone.listAllZones(accountId).pipe(Effect.orDie);

  yield* Effect.findFirst(zones, (zone) => Effect.succeed(zone.name === ROOT_DOMAIN)).pipe(
    Effect.flatMap((zone) =>
      Option.isSome(zone)
        ? Cloudflare.DNS.Record("sites-wildcard", {
            zoneId: zone.value.id,
            name: `*.${ORIGINS.sites}`,
            type: "CNAME",
            content: ORIGINS.sites,
            proxied: true,
            comment: "Managed by Alchemy (BlankParticle/BlankParticle/tools)",
          }).pipe(Namespace.push("DNS"), Namespace.push("Config"), Namespace.push("Tools"))
        : Effect.die(new Error(`Zone ${ROOT_DOMAIN} not found`)),
    ),
  );

  yield* Effect.forEach(
    zones,
    (zone) =>
      Effect.all([
        Cloudflare.Email.Routing(zone.name, { zone: zone.id }).pipe(Namespace.push("EmailRouting")),
        Cloudflare.Email.CatchAll(zone.name, {
          zone: zone.id,
          name: `Email rule engine for ${zone.name}`,
          actions: [{ type: "worker", value: [app.workerName] }],
        }).pipe(Namespace.push("EmailCatchAll")),
      ]).pipe(Namespace.push("Config"), Namespace.push("Tools")),
    { concurrency: "unbounded", discard: true },
  );
});

export const SetupToolsApp = ToolsApp.pipe(
  RemovalPolicy.retain(),
  Namespace.push("Tools"),
  Effect.tap((app) => SetupZones(app)),
);

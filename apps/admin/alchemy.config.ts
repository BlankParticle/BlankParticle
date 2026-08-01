import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const CloudflareAccountId = Effect.map(Effect.flatten(Cloudflare.CloudflareEnvironment), (env) => env.accountId);

const AdminApiToken = Effect.gen(function* () {
  const accountId = yield* CloudflareAccountId;
  const stage = yield* Alchemy.Stage;
  const token = yield* Cloudflare.ApiToken.AccountApiToken("AdminApiToken", {
    accountId,
    name:
      stage === "prod"
        ? "App Token (BlankParticle/BlankParticle/Admin)"
        : `[${stage}] App Token (BlankParticle/BlankParticle/Admin)`,
    policies: [
      {
        effect: "allow",
        permissionGroups: ["Email Routing Addresses Read", "Email Routing Addresses Write"],
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
      },
      {
        effect: "allow",
        // Zone Settings Read is required by GET /zones/:id/email/routing (the settings endpoint)
        permissionGroups: ["Zone Read", "Zone Settings Read", "Email Routing Rules Read", "Email Routing Rules Write"],
        resources: { [`com.cloudflare.api.account.${accountId}`]: { "com.cloudflare.api.account.zone.*": "*" } },
      },
    ],
  });
  return token.value;
});

export class AdminApp extends Cloudflare.Website.Vite<AdminApp>()("admin", {
  rootDir: import.meta.dirname,
  name: "admin",
  main: "src/worker.ts",
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    EMAIL_RULES: Cloudflare.KV.Namespace("EmailRules", { title: "admin-email-rules" }),
    CF_API_TOKEN: AdminApiToken,
    CF_ACCOUNT_ID: CloudflareAccountId,
  },
  domain: { name: "admin.blankparticle.com" },
  dev: { port: 5174 },
  workersDev: false,
}) {}

export type AdminAppEnv = Cloudflare.InferEnv<typeof AdminApp>;

export const SetupAccess = Effect.gen(function* () {
  const cloudflareAccountEmail = yield* Config.string("CLOUDFLARE_ACCOUNT_EMAIL");
  const stage = yield* Alchemy.Stage;

  if (stage !== "prod") return;
  const ownerPolicy = yield* Cloudflare.Access.Policy("AdminOwnerPolicy", {
    name: "Admin App Owner",
    decision: "allow",
    include: [{ email: { email: cloudflareAccountEmail } }],
    adopt: true,
  });

  yield* Cloudflare.Access.Application("AdminAccessApp", {
    type: "self_hosted",
    name: "BlankParticle Admin",
    domain: "admin.blankparticle.com",
    sessionDuration: "168h",
    policies: [ownerPolicy.policyId],
    appLauncherVisible: false,
    adopt: true,
  });
});

export const SetupEmailRouting = Effect.fn(function* (app: AdminApp) {
  const accountId = yield* CloudflareAccountId;
  const zones = yield* Cloudflare.Zone.listAllZones(accountId).pipe(Effect.orDie);

  yield* Effect.forEach(
    zones,
    (zone) =>
      Effect.gen(function* () {
        yield* Cloudflare.Email.Routing(`EmailRouting-${zone.name}`, { zone: zone.id });
        yield* Cloudflare.Email.CatchAll(`CatchAll-${zone.name}`, {
          zone: zone.id,
          name: `Email rule engine for ${zone.name}`,
          actions: [{ type: "worker", value: [app.workerName] }],
        });
      }),
    { discard: true, concurrency: "unbounded" },
  );
});

export const SetupAdminApp = Effect.gen(function* () {
  const app = yield* AdminApp;
  yield* SetupAccess;
  yield* SetupEmailRouting(app);
  return app;
});

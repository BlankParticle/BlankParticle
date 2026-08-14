import { CloudflareAccountEmail, CloudflareAccountId } from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

const AdminApiToken = Effect.gen(function* () {
  const accountId = yield* CloudflareAccountId;
  const stage = yield* Alchemy.Stage;

  const token =
    stage === "prod"
      ? yield* Cloudflare.ApiToken.AccountApiToken("AdminApiToken", {
          accountId,
          name: "App Token (BlankParticle/BlankParticle/Admin)",
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
      : yield* Cloudflare.ApiToken.AccountApiToken.ref("AdminApiToken", { stage: "prod" });

  return token.value;
});

const EmailRulesKV = Cloudflare.KV.Namespace("EmailRules", { title: "admin-email-rules" });

export class AdminApp extends Cloudflare.Website.Vite<AdminApp>()("admin", {
  rootDir: import.meta.dirname,
  name: "admin",
  main: "src/worker.ts",
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    EMAIL_RULES: EmailRulesKV,
    CF_API_TOKEN: AdminApiToken,
    CF_ACCOUNT_ID: CloudflareAccountId,
  },
  domain: { name: "admin.blankparticle.com" },
  dev: { port: 5174 },
  workersDev: false,
}) {}

export type AdminAppEnv = Cloudflare.InferEnv<typeof AdminApp>;

export const SetupAccess = Effect.gen(function* () {
  const stage = yield* Alchemy.Stage;
  const email = yield* CloudflareAccountEmail;

  if (stage === "prod") {
    const ownerPolicy = yield* Cloudflare.Access.Policy("AdminOwnerPolicy", {
      decision: "allow",
      include: [{ email: { email } }],
    });
    yield* Cloudflare.Access.Application("AdminAccessApp", {
      type: "self_hosted",
      name: "Admin",
      domain: "admin.blankparticle.com",
      sessionDuration: "168h",
      policies: [ownerPolicy.policyId],
      appLauncherVisible: false,
    });
  } else {
    yield* Cloudflare.Access.Policy.ref("AdminOwnerPolicy", { stage: "prod" });
    yield* Cloudflare.Access.Application.ref("AdminAccessApp", { stage: "prod" });
  }
});

export const SetupEmailRouting = Effect.fn(function* (app: AdminApp) {
  const accountId = yield* CloudflareAccountId;
  yield* Cloudflare.Zone.listAllZones(accountId).pipe(
    Effect.orDie,
    Effect.flatMap((zone) =>
      Effect.forEach(
        zone,
        (zone) =>
          Effect.all([
            Cloudflare.Email.Routing(`EmailRouting-${zone.name}`, { zone: zone.id }),
            Cloudflare.Email.CatchAll(`CatchAll-${zone.name}`, {
              zone: zone.id,
              name: `Email rule engine for ${zone.name}`,
              actions: [{ type: "worker", value: [app.workerName] }],
            }),
          ]),
        { concurrency: "unbounded", discard: true },
      ),
    ),
  );
});

export const SetupAdminApp = AdminApp.pipe(
  Effect.tap(SetupAccess),
  Effect.tap((app) => SetupEmailRouting(app)),
);

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

const githubRepo = { owner: "BlankParticle", repository: "BlankParticle" };

const CloudflareAccountId = Effect.map(Effect.flatten(Cloudflare.CloudflareEnvironment), (env) => env.accountId);

export default Alchemy.Stack(
  "GitHub",
  { providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()), state: Cloudflare.state() },
  Effect.gen(function* () {
    const accountId = yield* CloudflareAccountId;
    const accountEmail = yield* Config.string("CLOUDFLARE_ACCOUNT_EMAIL");

    const apiToken = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Workers Scripts Read",
            "Workers Scripts Write",
            "Secrets Store Read",
            "Secrets Store Write",
            "Workers KV Storage Read",
            "Workers KV Storage Write",
            "Email Routing Addresses Read",
            "Email Routing Addresses Write",
            // CI provisions the admin app's scoped api token
            "Account API Tokens Read",
            "Account API Tokens Write",
            // "Access: Apps and Policies Read/Write" — by id because the name is
            // duplicated across account/zone scopes; these are the account-scoped ones
            { id: "7ea222f6d5064cfa89ea366d7c1fee89" },
            { id: "1e13c5124ca64b72b1969a67e8829049" },
          ],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
        {
          effect: "allow",
          permissionGroups: [
            "Zone Read",
            // Zone Settings covers the email routing settings endpoints (read status, enable routing)
            "Zone Settings Read",
            "Zone Settings Write",
            "Email Routing Rules Read",
            "Email Routing Rules Write",
          ],
          resources: { [`com.cloudflare.api.account.${accountId}`]: { "com.cloudflare.api.account.zone.*": "*" } },
        },
      ],
      name: `Alchemy GitHub CI Token (${githubRepo.owner}/${githubRepo.repository})`,
    });

    yield* GitHub.Secret("cloudflare-api-token", {
      name: "CLOUDFLARE_API_TOKEN",
      value: apiToken.value,
      ...githubRepo,
    });

    yield* GitHub.Secret("cloudflare-account-id", {
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: Redacted.make(accountId),
      ...githubRepo,
    });

    yield* GitHub.Secret("cloudflare-account-email", {
      name: "CLOUDFLARE_ACCOUNT_EMAIL",
      value: Redacted.make(accountEmail),
      ...githubRepo,
    });
  }),
);

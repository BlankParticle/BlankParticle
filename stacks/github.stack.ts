import { StageInvariant, CloudflareAccountId, CloudflareAccountEmail } from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

const githubRepo = { owner: "BlankParticle", repository: "BlankParticle" };

export default Alchemy.Stack(
  "GitHub",
  { providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()), state: Cloudflare.state() },
  Effect.gen(function* () {
    yield* StageInvariant(Schema.Literal("prod")).pipe(Effect.orDie);

    const accountId = yield* CloudflareAccountId;
    const accountEmail = yield* CloudflareAccountEmail;
    const githubClientId = yield* Config.string("GITHUB_CLIENT_ID");
    const githubClientSecret = yield* Config.string("GITHUB_CLIENT_SECRET");

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
            "D1 Read",
            "D1 Write",
            "Workers Routes Read",
            "Workers Routes Write",
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

    yield* GitHub.Secret("CloudflareApiToken", {
      name: "CLOUDFLARE_API_TOKEN",
      value: apiToken.value,
      ...githubRepo,
    });

    yield* GitHub.Secret("CloudflareAccountId", {
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: Redacted.make(accountId),
      ...githubRepo,
    });

    yield* GitHub.Secret("CloudflareAccountEmail", {
      name: "CLOUDFLARE_ACCOUNT_EMAIL",
      value: Redacted.make(accountEmail),
      ...githubRepo,
    });

    yield* GitHub.Secret("GithubClientId", {
      name: "GH_CLIENT_ID",
      value: Redacted.make(githubClientId),
      ...githubRepo,
    });

    yield* GitHub.Secret("GithubClientSecret", {
      name: "GH_CLIENT_SECRET",
      value: Redacted.make(githubClientSecret),
      ...githubRepo,
    });
  }),
);

import {
  StageInvariant,
  CloudflareAccountId,
  CloudflareAccountEmail,
  GithubClientId,
  GithubClientSecret,
} from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Namespace from "alchemy/Namespace";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

/** Github Stack for https://github.com/BlankParticle/BlankParticle  */
const BlankParticle = Effect.gen(function* () {
  yield* GitHub.Repository("Repo", {
    name: "BlankParticle",
    owner: "BlankParticle",
    visibility: "public",
    description: "🌲 Monorepo for all things BlankParticle",
    homepage: "https://blankparticle.com",
    hasIssues: false,
    hasDiscussions: false,
    hasWiki: false,
    hasProjects: false,
    topics: ["blankparticle", "monorepo", "cloudflare", "typescript", "alchemy", "effect-ts"],
  });

  const accountId = yield* CloudflareAccountId;

  const ApiToken = yield* Cloudflare.ApiToken.AccountApiToken("CloudflareDeploymentToken", {
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
          "Account API Tokens Read",
          "Account API Tokens Write",
          // The admin app provisions a scoped token that manages account-level Access
          // applications and policies. These permission names also exist at zone scope,
          // so use the account-scoped permission-group IDs to avoid ambiguous lookup.
          { id: "7ea222f6d5064cfa89ea366d7c1fee89" }, // Access: Apps and Policies Read
          { id: "1e13c5124ca64b72b1969a67e8829049" }, // Access: Apps and Policies Write
        ],
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
      },
      {
        effect: "allow",
        permissionGroups: [
          "Zone Read",
          "Zone Settings Read",
          "Zone Settings Write",
          "Email Routing Rules Read",
          "Email Routing Rules Write",
        ],
        resources: {
          [`com.cloudflare.api.account.${accountId}`]: { "com.cloudflare.api.account.zone.*": "*" },
        },
      },
    ],
    name: `Alchemy Deployment Token (BlankParticle/BlankParticle)`,
  }).pipe(Effect.map((token) => token.value));

  yield* GitHub.Secrets({
    owner: "BlankParticle",
    repository: "BlankParticle",
    secrets: {
      CLOUDFLARE_ACCOUNT_EMAIL: CloudflareAccountEmail,
      CLOUDFLARE_API_TOKEN: ApiToken,
      CLOUDFLARE_ACCOUNT_ID: accountId,
      GH_CLIENT_ID: GithubClientId,
      GH_CLIENT_SECRET: GithubClientSecret,
    },
  }).pipe(Namespace.push("Secrets"));
}).pipe(Namespace.push("BlankParticle/BlankParticle"));

export default Alchemy.Stack(
  "GitHub",
  { providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()), state: Cloudflare.state() },
  Effect.gen(function* () {
    yield* StageInvariant(Schema.Literal("prod")).pipe(Effect.orDie);
    yield* Effect.all([BlankParticle], { discard: true, concurrency: "unbounded" }).pipe(Namespace.push("Repos"));
  }),
);

import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

const githubRepo = {
  owner: "BlankParticle",
  repository: "BlankParticle",
};

export default Alchemy.Stack(
  "GitHub",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const cloudflareAccountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID");

    const apiToken = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId: cloudflareAccountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Zone Read",
            "Workers Scripts Read",
            "Workers Scripts Write",
            "Secrets Store Read",
            "Secrets Store Write",
          ],
          resources: { [`com.cloudflare.api.account.${cloudflareAccountId}`]: "*" },
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
      value: Redacted.make(cloudflareAccountId),
      ...githubRepo,
    });
  }),
).pipe(adopt());

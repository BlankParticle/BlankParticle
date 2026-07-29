import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

class EmailNotVerifiedError extends Data.TaggedError("EmailNotVerified")<{ email: string }> {}

export default Alchemy.Stack(
  "Cloudflare",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const cloudflareAccountEmail = yield* Config.string("CLOUDFLARE_ACCOUNT_EMAIL");

    const destinationEmail = yield* Cloudflare.Email.Address("MainEmailInbox", { email: cloudflareAccountEmail });
    if (!destinationEmail.verified) yield* Effect.die(new EmailNotVerifiedError({ email: cloudflareAccountEmail }));

    const [primaryZone, ...extraZones] = ["blankparticle.com", "blankparticle.in", "rx2.dev"];

    yield* Cloudflare.Email.Rule("ForwardToMainEmail", {
      zone: primaryZone,
      name: "Forward primary email inbox",
      actions: [{ type: "forward", value: [destinationEmail.email] }],
      matchers: [{ type: "literal", field: "to", value: `hello@${primaryZone}` }],
    });

    yield* Effect.forEach(
      extraZones,
      (zone) =>
        Cloudflare.Email.CatchAll(`CatchAll-${zone}`, {
          zone,
          name: `Catch all emails for ${zone}`,
          actions: [{ type: "forward", value: [destinationEmail.email] }],
        }),
      { discard: true, concurrency: "unbounded" },
    );

    // Drop emails that are mostly spam/scraped by bots
    yield* Cloudflare.Email.Rule(`DropSpam-${primaryZone}`, {
      zone: primaryZone,
      name: "Drop spam emails",
      actions: [{ type: "drop" }],
      matchers: [{ type: "literal", field: "to", value: `web@${primaryZone}` }],
    });
    yield* Cloudflare.Email.Rule(`DropSpam-${extraZones[0]}`, {
      zone: extraZones[0],
      name: "Drop spam emails",
      actions: [{ type: "drop" }],
      matchers: [{ type: "literal", field: "to", value: `drop@${extraZones[0]}` }],
    });
  }),
).pipe(adopt());

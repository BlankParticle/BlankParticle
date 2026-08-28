import * as emailRouting from "@distilled.cloud/cloudflare/email-routing";
import * as zones from "@distilled.cloud/cloudflare/zones";
import { createServerFn } from "@tanstack/react-start";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { query } from "../db/index.ts";
import { WorkerEnv, type WorkerServices } from "./env.ts";
import * as rules from "./rules.ts";
import { RuleSet } from "./rules.ts";
import { requireUser } from "./server-fns.ts";

/** Runs an Effect for a signed-in, allow-listed user; anonymous calls throw before touching Cloudflare */
const run = <A, E>(effect: Effect.Effect<A, E, WorkerServices>): Promise<A> => requireUser().runtime.runPromise(effect);

export type EmailRoutingSettings = { enabled: boolean; status: string } | { error: string };

export type ZoneOverview = {
  id: string;
  name: string;
  status: string;
  routing: EmailRoutingSettings;
};

export type DestinationAddress = {
  id: string;
  email: string;
  verified: string | null;
};

const listZones = zones.listZones({ perPage: 50 }).pipe(Effect.map((page) => page.result));

const routingSettings = (zoneId: string) =>
  emailRouting.getEmailRouting({ zoneId }).pipe(
    Effect.map((settings): EmailRoutingSettings => ({
      enabled: settings.enabled,
      status: settings.status ?? "unknown",
    })),
    Effect.catch((error) => Effect.succeed<EmailRoutingSettings>({ error: String(error) })),
  );

const zoneOverviews = Effect.flatMap(listZones, (all) =>
  Effect.forEach(
    all,
    (zone) =>
      Effect.map(routingSettings(zone.id), (routing): ZoneOverview => ({
        id: zone.id,
        name: zone.name,
        status: zone.status ?? "unknown",
        routing,
      })),
    { concurrency: "unbounded" },
  ),
).pipe(Effect.map((list) => list.sort((a, b) => a.name.localeCompare(b.name))));

const listDestinations = Effect.gen(function* () {
  const { CF_ACCOUNT_ID } = yield* WorkerEnv;
  const page = yield* emailRouting.listAddresses({ accountId: CF_ACCOUNT_ID, perPage: 50 });
  return page.result.flatMap((address): DestinationAddress[] =>
    address.id && address.email ? [{ id: address.id, email: address.email, verified: address.verified ?? null }] : [],
  );
});

const readRuleSet = query(rules.readRuleSet);
const readActivity = query(rules.readActivity);

export const getEmailConfig = createServerFn().handler(() =>
  run(
    Effect.all(
      { zones: zoneOverviews, destinations: listDestinations, ruleSet: readRuleSet, activity: readActivity },
      { concurrency: "unbounded" },
    ),
  ),
);

/** Every forward target (rules and catch-alls) must be a destination Cloudflare has verified */
const assertForwardTargets = (ruleSet: RuleSet) =>
  Effect.gen(function* () {
    const verified = new Set((yield* listDestinations).filter((d) => d.verified).map((d) => d.email.toLowerCase()));
    const targets = [...ruleSet.rules.map((rule) => rule.action), ...Object.values(ruleSet.defaults)].flatMap(
      (action) => (action.type === "forward" ? [action.to] : []),
    );
    const unknown = targets.filter((to) => !verified.has(to.toLowerCase()));
    if (unknown.length > 0) return yield* Effect.die(new Error(`not a verified destination: ${unknown.join(", ")}`));
  });

export const saveRuleSet = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(RuleSet))
  .handler(({ data }) =>
    run(
      Effect.gen(function* () {
        yield* assertForwardTargets(data);
        yield* query((db) => rules.writeRuleSet(db, data));
        return data;
      }),
    ),
  );

export const clearActivity = createServerFn({ method: "POST" }).handler(() => run(query(rules.clearActivity)));

// Cloudflare sends a verification email; the address only becomes a valid forward target once confirmed
export const addDestination = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ email: Schema.String })))
  .handler(({ data }) =>
    run(
      Effect.gen(function* () {
        const { CF_ACCOUNT_ID } = yield* WorkerEnv;
        yield* emailRouting.createAddress({ accountId: CF_ACCOUNT_ID, email: data.email });
      }),
    ),
  );

export const removeDestination = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })))
  .handler(({ data }) =>
    run(
      Effect.gen(function* () {
        const { CF_ACCOUNT_ID } = yield* WorkerEnv;
        yield* emailRouting.deleteAddress({ accountId: CF_ACCOUNT_ID, destinationAddressIdentifier: data.id });
      }),
    ),
  );

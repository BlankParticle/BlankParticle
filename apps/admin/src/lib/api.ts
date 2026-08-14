import * as emailRouting from "@distilled.cloud/cloudflare/email-routing";
import * as zones from "@distilled.cloud/cloudflare/zones";
import { createServerFn, getGlobalStartContext } from "@tanstack/react-start";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { workerRuntime, WorkerEnv, type WorkerServices } from "./cloudflare.ts";
import { ACTIVITY_LOG_KEY, EMPTY_RULE_SET, RULESET_KEY, RuleSet, type ActivityEntry } from "./rules.ts";

const run = <A, E>(effect: Effect.Effect<A, E, WorkerServices>): Promise<A> => {
  const ctx = getGlobalStartContext();
  if (!ctx) throw new Error("Cloudflare request context unavailable");
  return workerRuntime(ctx.cf.env).runPromise(effect);
};

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

const listDestinations = Effect.gen(function* () {
  const { CF_ACCOUNT_ID } = yield* WorkerEnv;
  const page = yield* emailRouting.listAddresses({ accountId: CF_ACCOUNT_ID, perPage: 50 });
  return page.result.flatMap((address): DestinationAddress[] =>
    address.id && address.email ? [{ id: address.id, email: address.email, verified: address.verified ?? null }] : [],
  );
});

const readRuleSet = Effect.gen(function* () {
  const { EMAIL_RULES } = yield* WorkerEnv;
  const stored = yield* Effect.promise(() => EMAIL_RULES.get<RuleSet>(RULESET_KEY, "json"));
  return stored ?? EMPTY_RULE_SET;
});

const readActivity = Effect.gen(function* () {
  const { EMAIL_RULES } = yield* WorkerEnv;
  const log = yield* Effect.promise(() => EMAIL_RULES.get<ActivityEntry[]>(ACTIVITY_LOG_KEY, "json"));
  return log ?? [];
});

export const getZonesOverview = createServerFn().handler((): Promise<ZoneOverview[]> =>
  run(
    Effect.flatMap(listZones, (all) =>
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
    ),
  ),
);

export const getEmailConfig = createServerFn().handler(() =>
  run(
    Effect.all(
      {
        zones: Effect.map(listZones, (all) => all.map((zone) => zone.name).sort()),
        destinations: listDestinations,
        ruleSet: readRuleSet,
        activity: readActivity,
      },
      { concurrency: "unbounded" },
    ),
  ),
);

export const saveRuleSet = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(RuleSet))
  .handler(({ data }) =>
    run(
      Effect.gen(function* () {
        const { EMAIL_RULES } = yield* WorkerEnv;
        yield* Effect.promise(() => EMAIL_RULES.put(RULESET_KEY, JSON.stringify(data)));
        return data;
      }),
    ),
  );

export const clearActivity = createServerFn({ method: "POST" }).handler(() =>
  run(
    Effect.gen(function* () {
      const { EMAIL_RULES } = yield* WorkerEnv;
      yield* Effect.promise(() => EMAIL_RULES.delete(ACTIVITY_LOG_KEY));
    }),
  ),
);

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

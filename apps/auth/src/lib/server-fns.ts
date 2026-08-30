import { createServerFn } from "@tanstack/react-start";
import * as Drizzle from "alchemy/Drizzle/D1";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { Effect } from "effect";
import * as Schema from "effect/Schema";

import {
  apps,
  authorizationRequests,
  browserSessions,
  deviceCodes,
  tokens,
  users,
  type App,
  type BrowserSession,
  type Token,
  type User,
} from "#/db/schema.ts";
import { clientKey } from "#/lib/clients.ts";
import type { AuthRequestContext } from "#/request-context.ts";

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.scoped(effect));

const requireSession = (context: AuthRequestContext) => {
  if (context.session === null) throw new Error("not signed in");
  return { ...context.session, env: context.cf.env };
};

export type Dashboard = {
  user: User;
  /** The broker session behind this very request, to mark "this device" */
  sessionId: string;
  apps: App[];
  tokens: Token[];
  browserSessions: BrowserSession[];
} | null;

export const getDashboard = createServerFn().handler(({ context }): Promise<Dashboard> => {
  if (context.session === null) return Promise.resolve(null);
  const { id: sessionId, user } = context.session;
  return run(
    Effect.gen(function* () {
      const db = yield* Drizzle.D1(Effect.succeed(context.cf.env.DB));
      const now = Date.now();
      const [appRows, tokenRows, sessionRows] = yield* Effect.all(
        [
          db.select().from(apps).where(eq(apps.userId, user.id)).orderBy(desc(apps.createdAt)),
          db
            .select()
            .from(tokens)
            .where(and(eq(tokens.userId, user.id), isNull(tokens.revokedAt), gt(tokens.expiresAt, now)))
            .orderBy(desc(tokens.issuedAt)),
          db
            .select()
            .from(browserSessions)
            .where(and(eq(browserSessions.userId, user.id), gt(browserSessions.expiresAt, now)))
            .orderBy(desc(browserSessions.createdAt)),
        ],
        { concurrency: "unbounded" },
      );
      return { user, sessionId, apps: appRows, tokens: tokenRows, browserSessions: sessionRows };
    }),
  );
});

const StringId = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String }));

/** Forgets an authorization: the app will show the authorize page again next time */
export const removeApp = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Number })))
  .handler(({ data, context }) => {
    const { user, env } = requireSession(context);
    return run(
      Effect.gen(function* () {
        const db = yield* Drizzle.D1(Effect.succeed(env.DB));
        yield* db.delete(apps).where(and(eq(apps.id, data.id), eq(apps.userId, user.id)));
      }),
    );
  });

/** Kills one issued token: `/session/check` reports it revoked from now on */
export const revokeToken = createServerFn({ method: "POST" })
  .validator(StringId)
  .handler(({ data, context }) => {
    const { user, env } = requireSession(context);
    return run(
      Effect.gen(function* () {
        const db = yield* Drizzle.D1(Effect.succeed(env.DB));
        yield* db
          .update(tokens)
          .set({ revokedAt: Date.now() })
          .where(and(eq(tokens.jti, data.id), eq(tokens.userId, user.id)));
      }),
    );
  });

/** Signs a browser out of the broker; its next sign-in goes through GitHub again */
export const revokeBrowserSession = createServerFn({ method: "POST" })
  .validator(StringId)
  .handler(({ data, context }) => {
    const { user, env } = requireSession(context);
    return run(
      Effect.gen(function* () {
        const db = yield* Drizzle.D1(Effect.succeed(env.DB));
        yield* db
          .delete(browserSessions)
          .where(and(eq(browserSessions.id, data.id), eq(browserSessions.userId, user.id)));
      }),
    );
  });

/** Every device and every token, including the current ones */
export const signOutEverywhere = createServerFn({ method: "POST" }).handler(({ context }) => {
  const { user, env } = requireSession(context);
  return run(
    Effect.gen(function* () {
      const db = yield* Drizzle.D1(Effect.succeed(env.DB));
      yield* Effect.all(
        [
          db
            .update(tokens)
            .set({ revokedAt: Date.now() })
            .where(and(eq(tokens.userId, user.id), isNull(tokens.revokedAt))),
          db.delete(browserSessions).where(eq(browserSessions.userId, user.id)),
        ],
        { concurrency: "unbounded", discard: true },
      );
    }),
  );
});

export type ConsentRequest = {
  /** The app that started sign-in (`origin:…` or a reverse-DNS id), and how it introduced itself */
  clientId: string;
  name: string | null;
  logo: string | null;
  /** `aud` of the token; differs from `clientId` when a CLI signs in for an API */
  audience: string;
  /** Whether the client asked for profile details; otherwise it only gets an anonymous, site-specific id */
  pii: boolean;
  user: Pick<User, "login" | "name" | "picture" | "email">;
};

/** Looks up a pending consent request; the decision itself is posted to `/consent`. */
export const getConsentRequest = createServerFn()
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ token: Schema.String })))
  .handler(({ data, context }): Promise<ConsentRequest | null> => {
    const { env } = context.cf;
    return run(
      Effect.gen(function* () {
        const db = yield* Drizzle.D1(Effect.succeed(env.DB));
        const row = yield* db
          .select({ request: authorizationRequests, user: users })
          .from(authorizationRequests)
          .innerJoin(users, eq(authorizationRequests.userId, users.id))
          .where(
            and(
              eq(authorizationRequests.id, data.token),
              eq(authorizationRequests.stage, "consent"),
              gt(authorizationRequests.expiresAt, Date.now()),
            ),
          )
          .get();
        if (row === undefined) return null;
        const { request, user } = row;
        return {
          clientId: request.clientId,
          name: request.clientName,
          logo: request.clientLogo,
          audience: request.audience,
          pii: request.pii,
          user: { login: user.login, name: user.name, picture: user.picture, email: user.email },
        };
      }),
    );
  });

// ── Device flow ──────────────────────────────────────────────────────────────

export type DeviceRequest = Pick<ConsentRequest, "clientId" | "name" | "logo" | "audience" | "pii">;

const UserCode = Schema.String.check(Schema.isPattern(/^[A-Z]{8}$/));

/** Still-pending device request behind a user code, or `null` */
export const lookupDeviceCode = createServerFn()
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ code: UserCode })))
  .handler(({ data, context }): Promise<DeviceRequest | null> => {
    const { env } = requireSession(context);
    return run(
      Effect.gen(function* () {
        const db = yield* Drizzle.D1(Effect.succeed(env.DB));
        const row = yield* db
          .select()
          .from(deviceCodes)
          .where(
            and(
              eq(deviceCodes.userCode, data.code),
              eq(deviceCodes.status, "pending"),
              gt(deviceCodes.expiresAt, Date.now()),
            ),
          )
          .get();
        if (row === undefined) return null;
        return {
          clientId: row.clientId,
          name: row.clientName,
          logo: row.clientLogo,
          audience: row.audience,
          pii: row.pii,
        };
      }),
    );
  });

/** Approving also remembers the app; the waiting client picks the result up on its next `/token` poll */
export const decideDevice = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ code: UserCode, decision: Schema.Literals(["approved", "denied"]) })),
  )
  .handler(({ data, context }) => {
    const { user, env } = requireSession(context);
    return run(
      Effect.gen(function* () {
        const db = yield* Drizzle.D1(Effect.succeed(env.DB));
        const row = yield* db
          .select()
          .from(deviceCodes)
          .where(
            and(
              eq(deviceCodes.userCode, data.code),
              eq(deviceCodes.status, "pending"),
              gt(deviceCodes.expiresAt, Date.now()),
            ),
          )
          .get();
        if (row === undefined) return yield* Effect.die("that code is no longer valid");
        if (data.decision === "approved") {
          const approvedApp = {
            clientId: row.clientId,
            name: row.clientName,
            logo: row.clientLogo,
            pii: row.pii,
          };
          yield* db
            .insert(apps)
            .values({
              ...approvedApp,
              userId: user.id,
              clientKey: clientKey(row.clientId),
              audience: row.audience,
              createdAt: Date.now(),
            })
            .onConflictDoUpdate({
              target: [apps.userId, apps.clientKey, apps.audience],
              set: approvedApp,
            });
        }
        yield* db
          .update(deviceCodes)
          .set({ status: data.decision, userId: user.id })
          .where(eq(deviceCodes.deviceCode, row.deviceCode));
      }),
    );
  });

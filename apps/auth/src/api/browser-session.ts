import { and, eq, gt } from "drizzle-orm";
import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { browserSessions, users } from "#/db/schema.ts";

import { AuthDatabase } from "./context.ts";
import { SESSION_COOKIE } from "./flow.ts";

export const BrowserSession = Effect.gen(function* () {
  const db = yield* AuthDatabase;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const id = request.cookies[SESSION_COOKIE];
  if (id === undefined) return null;

  const row = yield* db
    .select({ user: users })
    .from(browserSessions)
    .innerJoin(users, eq(browserSessions.userId, users.id))
    .where(and(eq(browserSessions.id, id), gt(browserSessions.expiresAt, Date.now())))
    .get();
  return row === undefined ? null : { id, user: row.user };
});

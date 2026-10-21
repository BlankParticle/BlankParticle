import { eq } from "drizzle-orm";
import { Effect, Layer, Redacted } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { browserSessions, tokens } from "#/db/schema.ts";
import { verifyIdToken } from "#/lib/keys.ts";

import { AuthApi, BearerAuth, BearerToken, LoginRequired } from "../api.ts";
import { AuthDatabase, WorkerEnv } from "../context.ts";
import { SESSION_COOKIE } from "../flow.ts";

const BearerAuthLive = Layer.succeed(BearerAuth, {
  bearer: (httpEffect, { credential }) => Effect.provideService(httpEffect, BearerToken, credential),
});

const resolveBearerSession = Effect.gen(function* () {
  const env = yield* WorkerEnv;
  const db = yield* AuthDatabase;
  const bearer = Redacted.value(yield* BearerToken);
  if (bearer === "") return { reason: "invalid_token" } as const;

  const payload = yield* verifyIdToken(env, bearer, env.ISSUER);
  if (payload === null || typeof payload.jti !== "string") {
    return { reason: "invalid_token" } as const;
  }
  const token = yield* db.select().from(tokens).where(eq(tokens.jti, payload.jti)).get();
  if (token === undefined) return { reason: "invalid_token" } as const;
  if (token.revokedAt !== null) return { reason: "revoked" } as const;
  if (token.expiresAt <= Date.now()) return { reason: "expired" } as const;
  return { jti: token.jti } as const;
}).pipe(Effect.orDie);

export const SessionRoutes = HttpApiBuilder.group(AuthApi, "sessions", (handlers) =>
  handlers
    .handle("check", () =>
      Effect.gen(function* () {
        const result = yield* resolveBearerSession;
        if ("reason" in result) return yield* new LoginRequired({ status: "login_required", reason: result.reason });
        return { status: "active" } as const;
      }),
    )
    .handle("revoke", () =>
      Effect.gen(function* () {
        const db = yield* AuthDatabase;
        const request = yield* HttpServerRequest.HttpServerRequest;
        const result = yield* resolveBearerSession;
        if ("jti" in result) {
          yield* db.update(tokens).set({ revokedAt: Date.now() }).where(eq(tokens.jti, result.jti));
        }
        const browserSessionId = request.cookies[SESSION_COOKIE];
        if (browserSessionId !== undefined) {
          yield* db.delete(browserSessions).where(eq(browserSessions.id, browserSessionId));
        }
        return HttpServerResponse.expireCookieUnsafe(HttpServerResponse.empty(), SESSION_COOKIE, {
          path: "/",
          secure: true,
        });
      }).pipe(Effect.orDie),
    ),
).pipe(Layer.provide(BearerAuthLive));

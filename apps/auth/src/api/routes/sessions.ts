import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { browserSessions, tokens } from "@/db/schema.ts";
import { verifyIdToken } from "@/lib/keys.ts";

import { AuthDatabase, WorkerEnv } from "../context.ts";
import { SESSION_COOKIE } from "../flow.ts";

const resolveBearerSession = Effect.gen(function* () {
  const env = yield* WorkerEnv;
  const db = yield* AuthDatabase;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (bearer === undefined) return { reason: "invalid_token" } as const;

  const payload = yield* verifyIdToken(env, bearer, env.ISSUER);
  if (payload === null || typeof payload.jti !== "string") {
    return { reason: "invalid_token" } as const;
  }
  const token = yield* db.select().from(tokens).where(eq(tokens.jti, payload.jti)).get();
  if (token === undefined) return { reason: "invalid_token" } as const;
  if (token.revokedAt !== null) return { reason: "revoked" } as const;
  if (token.expiresAt <= Date.now()) return { reason: "expired" } as const;
  return { jti: token.jti } as const;
});

const Check = HttpRouter.add(
  "POST",
  "/session/check",
  Effect.gen(function* () {
    const result = yield* resolveBearerSession;
    return "reason" in result
      ? HttpServerResponse.jsonUnsafe({ status: "login_required", reason: result.reason }, { status: 401 })
      : HttpServerResponse.jsonUnsafe({ status: "active" });
  }),
);

const Revoke = HttpRouter.add(
  "POST",
  "/session/revoke",
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
  }),
);

export const SessionRoutes = Layer.mergeAll(Check, Revoke);

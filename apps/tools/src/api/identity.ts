import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { WorkerEnv } from "#/lib/env.ts";

import { ApiError } from "./errors.ts";

export type AuthUser = { sub: string; login: string; email: string | undefined; allowed: boolean };

let jwks: { origin: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;

const signingKeys = (origin: string) => {
  if (jwks?.origin !== origin) jwks = { origin, keys: createRemoteJWKSet(new URL("/.well-known/jwks.json", origin)) };
  return jwks.keys;
};

export const currentIdentity = Effect.gen(function* () {
  const env = yield* WorkerEnv;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  const token = bearer ?? request.cookies.bp_auth;
  if (token === undefined) return undefined;

  return yield* Effect.tryPromise(() =>
    jwtVerify(token, signingKeys(env.AUTH_ORIGIN), {
      issuer: env.AUTH_ORIGIN,
      audience: `origin:https://${env.ORIGINS.tools}`,
      algorithms: ["ES256"],
    }),
  ).pipe(
    Effect.map(({ payload }): AuthUser | undefined => {
      if (payload.sub === undefined || typeof payload.login !== "string") return undefined;
      const email = typeof payload.email === "string" ? payload.email : undefined;
      return {
        sub: payload.sub,
        login: payload.login,
        email,
        allowed: payload.email_verified === true && email?.toLowerCase() === env.OWNER_EMAIL.toLowerCase(),
      };
    }),
    Effect.catch(() => Effect.succeed(undefined)),
  );
});

export const apiUser = Effect.gen(function* () {
  const env = yield* WorkerEnv;
  const request = yield* HttpServerRequest.HttpServerRequest;
  if (new URL(request.originalUrl).hostname !== env.ORIGINS.tools)
    return yield* new ApiError({ status: 404, message: "not found" });
  const identity = yield* currentIdentity;
  if (identity === undefined) return yield* new ApiError({ status: 401, message: "unauthorized" });
  if (!identity.allowed)
    return yield* new ApiError({
      status: 403,
      message: `forbidden: ${identity.email ?? identity.login} is not allowed here`,
    });
  return { login: identity.login };
});

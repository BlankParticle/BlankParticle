import { Effect, Layer, Redacted } from "effect";
import { HttpServerRequest } from "effect/http";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { WorkerEnv } from "#/lib/env.ts";

import type { ToolsAppEnv } from "../../alchemy.config.ts";
import { Authorization, CurrentUser, Forbidden, NotFound, Unauthorized } from "./spec.ts";

export type AuthUser = { sub: string; login: string; email: string | undefined; allowed: boolean };

let jwks: { origin: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;

const signingKeys = (origin: string) => {
  if (jwks?.origin !== origin) jwks = { origin, keys: createRemoteJWKSet(new URL("/.well-known/jwks.json", origin)) };
  return jwks.keys;
};

/** The identity a session token carries, or undefined unless it is one of ours and still valid */
const verify = (env: ToolsAppEnv, token: string) =>
  Effect.tryPromise(() =>
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

export const currentIdentity = Effect.gen(function* () {
  const env = yield* WorkerEnv;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  const token = bearer ?? request.cookies.bp_auth;
  return token === undefined ? undefined : yield* verify(env, token);
});

/** Who is looking: `login` is the allow-listed owner identity if any; `signedIn` covers any valid session */
export type Viewer = { signedIn: boolean; login: string | undefined };

export const currentViewer = Effect.map(currentIdentity, (identity): Viewer => ({
  signedIn: identity !== undefined,
  login: identity?.allowed ? identity.login : undefined,
}));

/** The API's bearer auth: only on the tools host, and only for the allow-listed owner */
export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    return Authorization.of({
      bearer: Effect.fn(function* (httpEffect, { credential }) {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (new URL(request.originalUrl).hostname !== env.ORIGINS.tools)
          return yield* new NotFound({ message: "not found" });
        const token = Redacted.value(credential);
        const identity = token === "" ? undefined : yield* verify(env, token);
        if (identity === undefined) return yield* new Unauthorized({ message: "unauthorized" });
        if (!identity.allowed)
          return yield* new Forbidden({
            message: `forbidden: ${identity.email ?? identity.login} is not allowed here`,
          });
        return yield* Effect.provideService(httpEffect, CurrentUser, { login: identity.login });
      }),
    });
  }),
);

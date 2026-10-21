import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import { base64url } from "jose";

import { deviceCodes, users } from "#/db/schema.ts";
import { formatUserCode, USER_CODE_ALPHABET, USER_CODE_LENGTH } from "#/lib/clients.ts";

import { AuthApi, InvalidGrant, OAuthError, OAuthRequest, TemporarilyUnavailable } from "../api.ts";
import { AuthDatabase, WorkerEnv } from "../context.ts";
import { DEVICE_TTL, consumeRequest, issueToken, randomToken, resourceAudience } from "../flow.ts";

const DEVICE_INTERVAL = 5;
/** User codes are short, so a fresh one can collide with a live (or not yet swept) one */
const USER_CODE_ATTEMPTS = 5;

/** Uniform over the alphabet: bytes past the last whole multiple of its length are rejected, not wrapped */
function randomUserCode() {
  const limit = 256 - (256 % USER_CODE_ALPHABET.length);
  let code = "";
  while (code.length < USER_CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(USER_CODE_LENGTH - code.length))) {
      if (byte < limit) code += USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
    }
  }
  return code;
}

const invalidRequest = new OAuthError({ error: "invalid_request" });

// Undecodable forms fail with a schema error, other content types come back as a bare 415
const OAuthRequestLive = Layer.succeed(OAuthRequest, (httpEffect) =>
  httpEffect.pipe(
    Effect.filterOrFail(
      (response) => response.status !== 415,
      () => invalidRequest,
    ),
    Effect.catch((error) => Effect.fail(HttpApiError.HttpApiSchemaError.is(error) ? invalidRequest : error)),
  ),
);

export const TokenRoutes = HttpApiBuilder.group(AuthApi, "tokens", (handlers) =>
  handlers
    .handle("deviceCode", ({ payload: form }) =>
      Effect.gen(function* () {
        const env = yield* WorkerEnv;
        const db = yield* AuthDatabase;
        const requestedAudience = resourceAudience(form.resource);
        if (requestedAudience === null) {
          return yield* new OAuthError({
            error: "invalid_request",
            error_description: "The requested resource must be a plain https origin.",
          });
        }

        const deviceCode = randomToken();
        const now = Date.now();
        let userCode: string | undefined;
        for (let attempt = 0; userCode === undefined && attempt < USER_CODE_ATTEMPTS; attempt++) {
          const inserted = yield* db
            .insert(deviceCodes)
            .values({
              deviceCode,
              userCode: randomUserCode(),
              clientId: form.client_id,
              clientName: form.client_name ?? null,
              clientLogo: form.logo_uri ?? null,
              audience: requestedAudience ?? form.client_id,
              pii: form.pii,
              interval: DEVICE_INTERVAL,
              createdAt: now,
              expiresAt: now + DEVICE_TTL,
            })
            .onConflictDoNothing({ target: deviceCodes.userCode })
            .returning({ userCode: deviceCodes.userCode })
            .get();
          userCode = inserted?.userCode;
        }
        if (userCode === undefined) {
          return yield* new TemporarilyUnavailable({
            error: "temporarily_unavailable",
            error_description: "Could not allocate a user code.",
          });
        }

        const verificationUrl = new URL("/device", env.ISSUER);
        const completeUrl = new URL(verificationUrl);
        completeUrl.searchParams.set("code", formatUserCode(userCode));
        return {
          device_code: deviceCode,
          user_code: formatUserCode(userCode),
          verification_uri: verificationUrl.toString(),
          verification_uri_complete: completeUrl.toString(),
          expires_in: DEVICE_TTL / 1000,
          interval: DEVICE_INTERVAL,
        };
      }).pipe(Effect.catchTag("EffectDrizzleQueryError", Effect.die)),
    )
    .handle("token", ({ payload: form }) =>
      Effect.gen(function* () {
        const env = yield* WorkerEnv;
        const db = yield* AuthDatabase;

        if (form.grant_type === "urn:ietf:params:oauth:grant-type:device_code") {
          const grant = yield* db
            .select()
            .from(deviceCodes)
            .where(and(eq(deviceCodes.deviceCode, form.device_code), eq(deviceCodes.clientId, form.client_id)))
            .get();
          if (grant === undefined) return yield* new OAuthError({ error: "invalid_grant" });

          const now = Date.now();
          if (grant.expiresAt <= now) {
            yield* db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, grant.deviceCode));
            return yield* new OAuthError({ error: "expired_token" });
          }
          const polledTooSoon = grant.lastPolledAt !== null && now - grant.lastPolledAt < grant.interval * 1000;
          yield* db
            .update(deviceCodes)
            .set({
              lastPolledAt: now,
              ...(polledTooSoon && { interval: grant.interval + 5 }),
            })
            .where(eq(deviceCodes.deviceCode, grant.deviceCode));
          if (polledTooSoon) return yield* new OAuthError({ error: "slow_down" });
          if (grant.status === "pending") return yield* new OAuthError({ error: "authorization_pending" });

          yield* db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, grant.deviceCode));
          if (grant.status === "denied" || grant.userId === null) {
            return yield* new OAuthError({ error: "access_denied" });
          }
          const user = yield* db.select().from(users).where(eq(users.id, grant.userId)).get();
          if (user === undefined) return yield* new OAuthError({ error: "access_denied" });
          return yield* issueToken(db, env, user, grant);
        }

        const grant = yield* consumeRequest(db, form.code, "code");
        const user =
          grant === null || grant.userId === null
            ? undefined
            : yield* db.select().from(users).where(eq(users.id, grant.userId)).get();
        if (
          grant === null ||
          user === undefined ||
          form.client_id !== grant.clientId ||
          form.redirect_uri !== grant.redirectUri
        ) {
          return yield* new InvalidGrant({ error: "invalid_grant" });
        }

        const challenge = yield* Effect.tryPromise(async () => {
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(form.code_verifier));
          return base64url.encode(new Uint8Array(digest));
        });
        if (challenge !== grant.codeChallenge) return yield* new InvalidGrant({ error: "invalid_grant" });
        return yield* issueToken(db, env, user, grant);
      }).pipe(Effect.catchTag(["EffectDrizzleQueryError", "UnknownError"], Effect.die)),
    ),
).pipe(Layer.provide(OAuthRequestLive));

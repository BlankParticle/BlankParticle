import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { base64url } from "jose";

import { deviceCodes, users } from "#/db/schema.ts";
import { formatUserCode, USER_CODE_ALPHABET, USER_CODE_LENGTH } from "#/lib/clients.ts";

import { AuthDatabase, WorkerEnv } from "../context.ts";
import {
  DEVICE_TTL,
  consumeRequest,
  issueToken,
  randomToken,
  rejectInvalidRequest,
  resourceAudience,
} from "../flow.ts";
import { DeviceCodeForm, TokenForm } from "../schema.ts";

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

const DeviceCode = HttpRouter.add(
  "POST",
  "/device/code",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const db = yield* AuthDatabase;
    const form = yield* HttpServerRequest.schemaBodyUrlParams(DeviceCodeForm);
    const requestedAudience = resourceAudience(form.resource);
    if (requestedAudience === null) {
      return HttpServerResponse.jsonUnsafe(
        {
          error: "invalid_request",
          error_description: "The requested resource must be a plain https origin.",
        },
        { status: 400 },
      );
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
      return HttpServerResponse.jsonUnsafe(
        { error: "temporarily_unavailable", error_description: "Could not allocate a user code." },
        { status: 503 },
      );
    }

    const verificationUrl = new URL("/device", env.ISSUER);
    const completeUrl = new URL(verificationUrl);
    completeUrl.searchParams.set("code", formatUserCode(userCode));
    return HttpServerResponse.jsonUnsafe({
      device_code: deviceCode,
      user_code: formatUserCode(userCode),
      verification_uri: verificationUrl.toString(),
      verification_uri_complete: completeUrl.toString(),
      expires_in: DEVICE_TTL / 1000,
      interval: DEVICE_INTERVAL,
    });
  }).pipe(rejectInvalidRequest),
);

const Token = HttpRouter.add(
  "POST",
  "/token",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const db = yield* AuthDatabase;
    const form = yield* HttpServerRequest.schemaBodyUrlParams(TokenForm);

    if (form.grant_type === "urn:ietf:params:oauth:grant-type:device_code") {
      const grant = yield* db
        .select()
        .from(deviceCodes)
        .where(and(eq(deviceCodes.deviceCode, form.device_code), eq(deviceCodes.clientId, form.client_id)))
        .get();
      if (grant === undefined) {
        return HttpServerResponse.jsonUnsafe({ error: "invalid_grant" }, { status: 400 });
      }

      const now = Date.now();
      if (grant.expiresAt <= now) {
        yield* db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, grant.deviceCode));
        return HttpServerResponse.jsonUnsafe({ error: "expired_token" }, { status: 400 });
      }
      const polledTooSoon = grant.lastPolledAt !== null && now - grant.lastPolledAt < grant.interval * 1000;
      yield* db
        .update(deviceCodes)
        .set({
          lastPolledAt: now,
          ...(polledTooSoon && { interval: grant.interval + 5 }),
        })
        .where(eq(deviceCodes.deviceCode, grant.deviceCode));
      if (polledTooSoon) {
        return HttpServerResponse.jsonUnsafe({ error: "slow_down" }, { status: 400 });
      }
      if (grant.status === "pending") {
        return HttpServerResponse.jsonUnsafe({ error: "authorization_pending" }, { status: 400 });
      }

      yield* db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, grant.deviceCode));
      if (grant.status === "denied" || grant.userId === null) {
        return HttpServerResponse.jsonUnsafe({ error: "access_denied" }, { status: 400 });
      }
      const user = yield* db.select().from(users).where(eq(users.id, grant.userId)).get();
      if (user === undefined) {
        return HttpServerResponse.jsonUnsafe({ error: "access_denied" }, { status: 400 });
      }
      return HttpServerResponse.jsonUnsafe(yield* issueToken(db, env, user, grant));
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
      return HttpServerResponse.jsonUnsafe({ error: "invalid_grant" }, { status: 401 });
    }

    const challenge = yield* Effect.tryPromise(async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(form.code_verifier));
      return base64url.encode(new Uint8Array(digest));
    });
    if (challenge !== grant.codeChallenge) {
      return HttpServerResponse.jsonUnsafe({ error: "invalid_grant" }, { status: 401 });
    }
    return HttpServerResponse.jsonUnsafe(yield* issueToken(db, env, user, grant));
  }).pipe(rejectInvalidRequest),
);

export const TokenRoutes = Layer.mergeAll(DeviceCode, Token);

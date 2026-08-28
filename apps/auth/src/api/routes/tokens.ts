import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { base64url } from "jose";

import { deviceCodes, users } from "@/db/schema.ts";
import { formatUserCode, USER_CODE_ALPHABET, USER_CODE_LENGTH } from "@/lib/clients.ts";

import { AuthDatabase, WorkerEnv } from "../context.ts";
import {
  DEVICE_TTL,
  consumeRequest,
  issueToken,
  randomToken,
  resourceAudience,
  sweepExpiredRequests,
} from "../flow.ts";
import { DeviceCodeForm, TokenForm } from "../schema.ts";

const DEVICE_INTERVAL = 5;

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

    yield* sweepExpiredRequests(db);
    const deviceCode = randomToken();
    const bytes = crypto.getRandomValues(new Uint8Array(USER_CODE_LENGTH));
    const userCode = Array.from(bytes, (byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length]).join("");
    const now = Date.now();
    yield* db.insert(deviceCodes).values({
      deviceCode,
      userCode,
      clientId: form.client_id,
      clientName: form.client_name ?? null,
      clientLogo: form.logo_uri ?? null,
      audience: requestedAudience ?? form.client_id,
      pii: form.pii === "true" || form.pii === "1",
      interval: DEVICE_INTERVAL,
      createdAt: now,
      expiresAt: now + DEVICE_TTL,
    });

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
  }).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: "invalid_request" }, { status: 400 })),
    ),
  ),
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
  }).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: "invalid_request" }, { status: 400 })),
    ),
  ),
);

export const TokenRoutes = Layer.mergeAll(DeviceCode, Token);

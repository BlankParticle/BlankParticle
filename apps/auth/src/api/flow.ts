import { and, eq, gt, lt } from "drizzle-orm";
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { base64url } from "jose";

import { apps, authorizationRequests, deviceCodes, tokens, type AuthorizationRequest, type User } from "#/db/schema.ts";
import { clientKey } from "#/lib/clients.ts";
import { signIdToken } from "#/lib/keys.ts";

import type { AuthAppEnv } from "../../alchemy.config.ts";
import type { AuthDatabase } from "./context.ts";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const TOKEN_TTL = 30 * DAY;
export const SESSION_TTL = 30 * DAY;
export const PENDING_TTL = 10 * MINUTE;
export const CODE_TTL = 2 * MINUTE;
export const DEVICE_TTL = 15 * MINUTE;
export const SESSION_COOKIE = "auth_session";

export type Grant = {
  clientId: string;
  clientName: string | null;
  clientLogo: string | null;
  audience: string;
  pii: boolean;
};

export type Draft = Grant & Pick<AuthorizationRequest, "redirectUri" | "clientState" | "codeChallenge">;

export const randomToken = () => base64url.encode(crypto.getRandomValues(new Uint8Array(32)));

export function resourceAudience(resource: string | undefined) {
  if (resource === undefined) return undefined;
  if (!URL.canParse(resource)) return null;
  const url = new URL(resource);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return null;
  }
  return `origin:${url.origin}`;
}

export function errorPage(issuer: string, title: string, message: string) {
  const url = new URL("/error", issuer);
  url.searchParams.set("title", title);
  url.searchParams.set("message", message);
  return HttpServerResponse.redirect(url);
}

export function draftFrom(row: AuthorizationRequest): Draft {
  return {
    redirectUri: row.redirectUri,
    clientId: row.clientId,
    clientName: row.clientName,
    clientLogo: row.clientLogo,
    audience: row.audience,
    clientState: row.clientState,
    codeChallenge: row.codeChallenge,
    pii: row.pii,
  };
}

export function redirectToClient(draft: Draft, params: Record<string, string>) {
  const url = new URL(draft.redirectUri);
  for (const [name, value] of Object.entries({ ...params, state: draft.clientState })) {
    url.searchParams.set(name, value);
  }
  return HttpServerResponse.redirect(url);
}

export function stageRequest(
  db: AuthDatabase,
  draft: Draft,
  stage: AuthorizationRequest["stage"],
  userId: number | null,
  ttl: number,
) {
  return Effect.gen(function* () {
    const id = randomToken();
    yield* db.insert(authorizationRequests).values({
      ...draft,
      id,
      stage,
      userId,
      expiresAt: Date.now() + ttl,
    });
    return id;
  });
}

export function consumeRequest(db: AuthDatabase, id: string, stage: AuthorizationRequest["stage"]) {
  return Effect.gen(function* () {
    const row = yield* db
      .select()
      .from(authorizationRequests)
      .where(
        and(
          eq(authorizationRequests.id, id),
          eq(authorizationRequests.stage, stage),
          gt(authorizationRequests.expiresAt, Date.now()),
        ),
      )
      .get();
    if (row === undefined) return null;
    yield* db.delete(authorizationRequests).where(eq(authorizationRequests.id, id));
    return row;
  });
}

export function sweepExpiredRequests(db: AuthDatabase) {
  const now = Date.now();
  return Effect.all(
    [
      db.delete(authorizationRequests).where(lt(authorizationRequests.expiresAt, now)),
      db.delete(deviceCodes).where(lt(deviceCodes.expiresAt, now)),
    ],
    { concurrency: "unbounded", discard: true },
  );
}

export function issueCode(db: AuthDatabase, draft: Draft, user: User) {
  return Effect.gen(function* () {
    const code = yield* stageRequest(db, draft, "code", user.id, CODE_TTL);
    return redirectToClient(draft, { code });
  });
}

function pairwiseSubject(secret: string, input: string, prefix: string) {
  return Effect.tryPromise(async () => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
    return `${prefix}_${base64url.encode(new Uint8Array(mac))}`;
  });
}

export function issueToken(db: AuthDatabase, env: AuthAppEnv, user: User, grant: Grant) {
  return Effect.gen(function* () {
    const [subject, piiSubject] = yield* Effect.all(
      [
        pairwiseSubject(env.PAIRWISE_SECRET, `${user.id}:${grant.audience}`, "ps"),
        grant.pii ? pairwiseSubject(env.PAIRWISE_SECRET, `pii:${user.id}`, "pii") : Effect.succeed(null),
      ],
      { concurrency: "unbounded" },
    );
    const now = Date.now();
    const issuedAt = Math.floor(now / 1000);
    const jti = randomToken();
    const idToken = yield* signIdToken(env, {
      iss: env.ISSUER,
      aud: grant.audience,
      sub: subject,
      pairwise_sub: subject,
      iat: issuedAt,
      exp: issuedAt + TOKEN_TTL / 1000,
      jti,
      ...(grant.pii && {
        login: user.login,
        name: user.name ?? undefined,
        picture: user.picture,
        email: user.email ?? undefined,
        email_verified: user.email === null ? undefined : user.emailVerified,
        pii_sub: piiSubject ?? undefined,
      }),
    });
    yield* db.insert(tokens).values({
      jti,
      userId: user.id,
      clientId: grant.clientId,
      clientName: grant.clientName,
      clientLogo: grant.clientLogo,
      audience: grant.audience,
      pii: grant.pii,
      issuedAt: now,
      expiresAt: now + TOKEN_TTL,
    });
    return { id_token: idToken, pairwise_sub: subject, token_type: "Bearer", expires_in: TOKEN_TTL / 1000 };
  });
}

export function continueAuthorization(db: AuthDatabase, env: AuthAppEnv, draft: Draft, user: User) {
  return Effect.gen(function* () {
    if (draft.clientId === `origin:${env.ISSUER}`) {
      const url = new URL(draft.redirectUri);
      return HttpServerResponse.redirect(url.pathname + url.search);
    }
    // Web clients prove their identity through the redirect origin. Native client IDs are
    // self-asserted, so another app can claim the same ID and must never inherit remembered consent.
    if (draft.clientId.startsWith("origin:")) {
      const knownApp = yield* db
        .select({ id: apps.id })
        .from(apps)
        .where(
          and(
            eq(apps.userId, user.id),
            eq(apps.clientKey, clientKey(draft.clientId)),
            eq(apps.audience, draft.audience),
          ),
        )
        .get();
      if (knownApp !== undefined) return yield* issueCode(db, draft, user);
    }

    const token = yield* stageRequest(db, draft, "consent", user.id, PENDING_TTL);
    const url = new URL("/consent", env.ISSUER);
    url.searchParams.set("token", token);
    return HttpServerResponse.redirect(url);
  });
}

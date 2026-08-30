import { and, eq, gt } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { apps, browserSessions, users } from "#/db/schema.ts";
import { clientFor, clientKey, isLoopback } from "#/lib/clients.ts";

import { AuthDatabase, WorkerEnv } from "../context.ts";
import {
  PENDING_TTL,
  SESSION_COOKIE,
  SESSION_TTL,
  consumeRequest,
  continueAuthorization,
  draftFrom,
  errorPage,
  issueCode,
  randomToken,
  redirectToClient,
  resourceAudience,
  stageRequest,
  sweepExpiredRequests,
  type Draft,
} from "../flow.ts";
import { AuthorizationQuery, CallbackQuery, ConsentForm, GitHubEmails, GitHubToken, GitHubUser } from "../schema.ts";

const GITHUB_HEADERS = { accept: "application/json", "user-agent": "BlankParticle Auth" };

function sendToGitHub(clientId: string, issuer: string, state: string) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${issuer}/callback`,
    scope: "read:user user:email",
    state,
  }).toString();
  return HttpServerResponse.redirect(url);
}

const Authorize = HttpRouter.add(
  "GET",
  "/authorize",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const db = yield* AuthDatabase;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const query = yield* HttpServerRequest.schemaSearchParams(AuthorizationQuery);

    if (!URL.canParse(query.redirect_uri)) {
      return errorPage(env.ISSUER, "Invalid sign-in request", "Invalid redirect URL.");
    }
    const redirectUrl = new URL(query.redirect_uri);
    // web apps redirect to https, or to a loopback origin under `alchemy dev` (`clientKey` drops the port)
    if (
      (query.client_type === "web" && redirectUrl.protocol !== "https:" && !isLoopback(redirectUrl)) ||
      (query.client_type === "native" && !isLoopback(redirectUrl))
    ) {
      return errorPage(env.ISSUER, "Invalid sign-in request", "Invalid redirect URL.");
    }
    const requestedAudience = resourceAudience(query.resource);
    if (requestedAudience === null) {
      return errorPage(env.ISSUER, "Invalid sign-in request", "The requested resource must be a plain https origin.");
    }
    const clientId = query.client_type === "native" ? query.client_id : clientFor(query.redirect_uri);
    if (query.client_type === "web" && query.client_id !== undefined && query.client_id !== clientId) {
      return errorPage(env.ISSUER, "Invalid sign-in request", "Invalid redirect URL.");
    }

    const draft: Draft = {
      redirectUri: query.redirect_uri,
      clientId,
      clientName: query.client_name ?? null,
      clientLogo: query.logo_uri ?? null,
      audience: requestedAudience ?? clientId,
      clientState: query.state,
      codeChallenge: query.code_challenge,
      pii: query.pii === "true" || query.pii === "1",
    };
    yield* sweepExpiredRequests(db);

    const sessionId = request.cookies[SESSION_COOKIE];
    const session =
      sessionId === undefined
        ? undefined
        : yield* db
            .select({ user: users })
            .from(browserSessions)
            .innerJoin(users, eq(browserSessions.userId, users.id))
            .where(and(eq(browserSessions.id, sessionId), gt(browserSessions.expiresAt, Date.now())))
            .get();
    if (session !== undefined) return yield* continueAuthorization(db, env, draft, session.user);

    const state = yield* stageRequest(db, draft, "pending", null, PENDING_TTL);
    return sendToGitHub(env.GITHUB_CLIENT_ID, env.ISSUER, state);
  }).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: "invalid_request" }, { status: 400 })),
    ),
  ),
);

const Login = HttpRouter.add(
  "GET",
  "/login",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const db = yield* AuthDatabase;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const requestedPath = new URL(request.originalUrl).searchParams.get("return_to");
    const path = requestedPath !== null && /^\/(?!\/)\S*$/.test(requestedPath) ? requestedPath : "/";
    const sessionId = request.cookies[SESSION_COOKIE];
    const session =
      sessionId === undefined
        ? undefined
        : yield* db
            .select({ id: browserSessions.id })
            .from(browserSessions)
            .where(and(eq(browserSessions.id, sessionId), gt(browserSessions.expiresAt, Date.now())))
            .get();
    if (session !== undefined) return HttpServerResponse.redirect(path);

    yield* sweepExpiredRequests(db);
    const homeClient = `origin:${env.ISSUER}`;
    const state = yield* stageRequest(
      db,
      {
        redirectUri: `${env.ISSUER}${path}`,
        clientId: homeClient,
        clientName: null,
        clientLogo: null,
        audience: homeClient,
        clientState: "",
        codeChallenge: "",
        pii: false,
      },
      "pending",
      null,
      PENDING_TTL,
    );
    return sendToGitHub(env.GITHUB_CLIENT_ID, env.ISSUER, state);
  }),
);

const Logout = HttpRouter.add(
  "POST",
  "/logout",
  Effect.gen(function* () {
    const db = yield* AuthDatabase;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId !== undefined) {
      yield* db.delete(browserSessions).where(eq(browserSessions.id, sessionId));
    }
    return HttpServerResponse.expireCookieUnsafe(HttpServerResponse.redirect("/"), SESSION_COOKIE, {
      path: "/",
      secure: true,
    });
  }),
);

const Callback = HttpRouter.add(
  "GET",
  "/callback",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const db = yield* AuthDatabase;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const query = yield* HttpServerRequest.schemaSearchParams(CallbackQuery);
    const row = yield* consumeRequest(db, query.state, "pending");
    if (row === null) {
      return errorPage(env.ISSUER, "Sign-in expired", "The sign-in request is missing or has expired.");
    }

    const draft = draftFrom(row);
    if (query.code === undefined) return redirectToClient(draft, { error: query.error ?? "access_denied" });

    const tokenResponse = yield* Effect.tryPromise(() =>
      fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { ...GITHUB_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: query.code,
          redirect_uri: `${env.ISSUER}/callback`,
        }),
      }),
    );
    const token = yield* Effect.tryPromise(() => tokenResponse.json()).pipe(
      Effect.flatMap(S.decodeUnknownEffect(GitHubToken)),
    );
    if (token.access_token === undefined) {
      return errorPage(env.ISSUER, "GitHub sign-in failed", token.error ?? "GitHub did not return an access token.");
    }

    const headers = {
      ...GITHUB_HEADERS,
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token.access_token}`,
    };
    const [userResponse, emailResponse] = yield* Effect.all(
      [
        Effect.tryPromise(() => fetch("https://api.github.com/user", { headers })),
        Effect.tryPromise(() => fetch("https://api.github.com/user/emails", { headers })),
      ],
      { concurrency: "unbounded" },
    );
    if (!userResponse.ok) {
      return errorPage(env.ISSUER, "GitHub sign-in failed", "GitHub did not return your identity.");
    }
    const githubUser = yield* Effect.tryPromise(() => userResponse.json()).pipe(
      Effect.flatMap(S.decodeUnknownEffect(GitHubUser)),
    );
    const emails = emailResponse.ok
      ? yield* Effect.tryPromise(() => emailResponse.json()).pipe(Effect.flatMap(S.decodeUnknownEffect(GitHubEmails)))
      : [];
    const primaryEmail = emails.find((email) => email.primary) ?? emails[0];
    const profile = {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name,
      picture: githubUser.avatar_url,
      email: primaryEmail?.email ?? null,
      emailVerified: primaryEmail?.verified ?? false,
    };
    const now = Date.now();
    const { id: _, ...freshProfile } = profile;
    const user = yield* db
      .insert(users)
      .values({ ...profile, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: users.id, set: { ...freshProfile, updatedAt: now } })
      .returning()
      .get();

    const sessionId = randomToken();
    yield* db.insert(browserSessions).values({
      id: sessionId,
      userId: user.id,
      userAgent: request.headers["user-agent"] ?? "",
      createdAt: now,
      expiresAt: now + SESSION_TTL,
    });
    return HttpServerResponse.setCookieUnsafe(
      yield* continueAuthorization(db, env, draft, user),
      SESSION_COOKIE,
      sessionId,
      { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: SESSION_TTL / 1000 },
    );
  }).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: "invalid_request" }, { status: 400 })),
    ),
  ),
);

const Consent = HttpRouter.add(
  "POST",
  "/consent",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const db = yield* AuthDatabase;
    const form = yield* HttpServerRequest.schemaBodyUrlParams(ConsentForm);
    const row = yield* consumeRequest(db, form.token, "consent");
    const user =
      row === null || row.userId === null
        ? undefined
        : yield* db.select().from(users).where(eq(users.id, row.userId)).get();
    if (row === null || user === undefined) {
      return errorPage(env.ISSUER, "Sign-in expired", "The consent request is missing or has expired.");
    }
    const draft = draftFrom(row);
    if (form.decision === "deny") return redirectToClient(draft, { error: "access_denied" });

    const approvedApp = {
      clientId: draft.clientId,
      name: draft.clientName,
      logo: draft.clientLogo,
      pii: draft.pii,
    };
    yield* db
      .insert(apps)
      .values({
        ...approvedApp,
        userId: user.id,
        clientKey: clientKey(draft.clientId),
        audience: draft.audience,
        createdAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: [apps.userId, apps.clientKey, apps.audience],
        set: approvedApp,
      });
    return yield* issueCode(db, draft, user);
  }).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: "invalid_request" }, { status: 400 })),
    ),
  ),
);

export const AuthorizationRoutes = Layer.mergeAll(Authorize, Login, Logout, Callback, Consent);

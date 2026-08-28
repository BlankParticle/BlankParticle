import { eq, lt } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as Schema from "effect/Schema";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { isSafeNext } from "@/api/spec.ts";
import { database } from "@/db/index.ts";
import { pendingLogins } from "@/db/schema.ts";
import { WorkerEnv } from "@/lib/env.ts";

const Tokens = Schema.Struct({ id_token: Schema.String, expires_in: Schema.Number });
const random = () => crypto.randomUUID().replaceAll("-", "");
const base64url = (bytes: Uint8Array<ArrayBuffer> | ArrayBuffer) =>
  btoa(String.fromCharCode(...(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const cookie = (domain: string, value: string, maxAge: number) =>
  `bp_auth=${value}; Domain=.${domain}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const execute = (request: HttpClientRequest.HttpClientRequest) =>
  HttpClient.execute(request).pipe(Effect.provide(FetchHttpClient.layer));

const Login = HttpRouter.add(
  "GET",
  "/auth/login",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(
      yield* Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
    );
    const state = random();
    const callback = `${new URL(request.originalUrl).origin}/auth/callback`;
    const now = Date.now();
    const db = database(env.DB);
    yield* Effect.promise(() => db.delete(pendingLogins).where(lt(pendingLogins.expiresAt, now)));
    const returnTo = new URL(request.originalUrl).searchParams.get("return_to");
    yield* Effect.promise(() =>
      db.insert(pendingLogins).values({
        state,
        codeVerifier: verifier,
        redirectUri: callback,
        returnTo: returnTo !== null && isSafeNext(returnTo) ? returnTo : "/",
        expiresAt: now + 10 * 60 * 1000,
      }),
    );
    const authorize = new URL(`${env.AUTH_ORIGIN}/authorize`);
    authorize.search = new URLSearchParams({
      client_type: "web",
      redirect_uri: callback,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      pii: "true",
      resource: `https://${env.ORIGINS.tools}`,
      client_name: "tools",
      logo_uri: `https://${env.ORIGINS.tools}/favicon.svg`,
    }).toString();
    return HttpServerResponse.redirect(authorize);
  }),
);

const Callback = HttpRouter.add(
  "GET",
  "/auth/callback",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(request.originalUrl);
    const state = url.searchParams.get("state") ?? "";
    const db = database(env.DB);
    const pending = yield* Effect.promise(() =>
      db.select().from(pendingLogins).where(eq(pendingLogins.state, state)).get(),
    );
    if (pending === undefined || pending.expiresAt <= Date.now())
      return HttpServerResponse.text("Login expired", { status: 400 });
    yield* Effect.promise(() => db.delete(pendingLogins).where(eq(pendingLogins.state, state)));
    const code = url.searchParams.get("code");
    if (code === null) return HttpServerResponse.text("Login failed", { status: 401 });

    const response = yield* execute(
      HttpClientRequest.post(`${env.AUTH_ORIGIN}/token`).pipe(
        HttpClientRequest.bodyUrlParams({
          grant_type: "authorization_code",
          code,
          client_id: `origin:${new URL(pending.redirectUri).origin}`,
          redirect_uri: pending.redirectUri,
          code_verifier: pending.codeVerifier,
        }),
      ),
    );
    if (response.status < 200 || response.status >= 300)
      return HttpServerResponse.text("Login failed", { status: 401 });
    const tokens = yield* HttpClientResponse.schemaBodyJson(Tokens)(response);
    return HttpServerResponse.redirect(pending.returnTo, {
      headers: { "set-cookie": cookie(env.ROOT_DOMAIN, tokens.id_token, tokens.expires_in) },
    });
  }),
);

const Logout = HttpRouter.add(
  "POST",
  "/auth/logout",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const token = request.cookies.bp_auth;
    if (token !== undefined) {
      yield* execute(
        HttpClientRequest.post(`${env.AUTH_ORIGIN}/session/revoke`).pipe(
          HttpClientRequest.setHeader("authorization", `Bearer ${token}`),
        ),
      ).pipe(Effect.ignore);
    }
    return HttpServerResponse.redirect("/", {
      headers: { "set-cookie": cookie(env.ROOT_DOMAIN, "", 0) },
    });
  }),
);

export const AuthRoutes = Layer.mergeAll(Login, Callback, Logout);

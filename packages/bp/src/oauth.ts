import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import * as Console from "effect/Console";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Schema from "effect/Schema";

import { type Credentials, loadCredentials, saveCredentials } from "./credentials.ts";
import { openBrowser, useDeviceLogin } from "./desktop.ts";
import { fail, UserError } from "./runtime.ts";

const CALLBACK_TIMEOUT_MS = 2 * 60 * 1000;

const Discovery = Schema.Struct({
  authorization_endpoint: Schema.String,
  token_endpoint: Schema.String,
  device_authorization_endpoint: Schema.optional(Schema.String),
});
/** The signed id_token is the bearer credential; there is no refresh, `bp login` again once it expires */
const TokenResponse = Schema.Struct({ id_token: Schema.String, expires_in: Schema.Number });

const requestJson = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  request: HttpClientRequest.HttpClientRequest,
) =>
  Effect.gen(function* () {
    const response = yield* HttpClient.execute(request);
    if (response.status < 200 || response.status >= 300) {
      return yield* fail(`OAuth request failed: ${response.status} ${yield* response.text}`);
    }
    return yield* HttpClientResponse.schemaBodyJson(schema)(response);
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof UserError ? cause : new UserError({ message: `OAuth request failed: ${cause}` }),
    ),
  );

const randomBase64Url = (bytes: number) =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");

const challengeFor = (verifier: string) =>
  Effect.promise(async () =>
    Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url"),
  );

const callbackPage = (outcome: "done" | "failure") => {
  const failed = outcome === "failure";
  return HttpServerResponse.text(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${failed ? "Sign-in failed" : "Signed in"} · blankparticle</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400..700&family=Plus+Jakarta+Sans:wght@700..800&display=swap">
  <style>
    :root { color-scheme: light; --paper: oklch(98.4% .005 85); --card: oklch(99.6% .002 85); --ink: oklch(23% .025 290); --ink-muted: oklch(44% .025 290); --violet: oklch(46% .17 295); --orange-deep: oklch(52% .16 40); --highlight: oklch(92% .12 118); }
    * { box-sizing: border-box; }
    html { font-family: Figtree, "Helvetica Neue", Arial, sans-serif; color: var(--ink); background: var(--paper); -webkit-font-smoothing: antialiased; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
    main { width: min(100%, 440px); }
    .brand { display: flex; align-items: center; justify-content: center; gap: 9px; margin-bottom: 18px; font-weight: 700; }
    .brand-mark { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 7px; color: var(--card); background: var(--violet); }
    .brand-mark svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
    .card { border: 2px solid var(--ink); border-radius: 12px; padding: 40px 28px; text-align: center; background: var(--card); box-shadow: 4px 4px 0 ${failed ? "var(--orange-deep)" : "var(--violet)"}; }
    .icon { width: 48px; height: 48px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 999px; background: ${failed ? "color-mix(in oklch, var(--orange-deep) 12%, var(--paper))" : "var(--highlight)"}; color: ${failed ? "var(--orange-deep)" : "var(--ink)"}; }
    .icon svg { width: 24px; height: 24px; stroke: currentColor; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    h1 { margin: 0; font-family: "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
    p { max-width: 340px; margin: 8px auto 0; color: var(--ink-muted); font-size: 15px; line-height: 1.5; text-wrap: balance; }
  </style>
</head>
<body>
  <main>
    <div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 0 1 14 0c0 3.2-.5 6.2-1.6 8.8M8 12a4 4 0 0 1 8 0c0 4-.8 7.1-2 9M11 12a1 1 0 0 1 2 0c0 3.7-.6 6.7-1.7 9M5.5 16.5c-.4 1.5-.9 2.8-1.5 4"/></svg></span><span>auth · blankparticle</span></div>
    <section class="card">
      <div class="icon" aria-hidden="true">${failed ? '<svg viewBox="0 0 24 24"><path d="M12 8v5"/><path d="M12 17h.01"/><path d="M10.3 3.8 2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.8a2 2 0 0 0-3.4 0Z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>'}</div>
      <h1>${failed ? "Sign-in failed" : "Signed in to bp"}</h1>
      <p>${failed ? "Return to your terminal to see what went wrong and try again." : "You’re all set. You can close this tab and return to your terminal."}</p>
    </section>
  </main>
</body>
</html>`,
    { status: failed ? 400 : 200, contentType: "text/html; charset=utf-8" },
  );
};

const callback = (expectedState: string) =>
  Effect.gen(function* () {
    const result = yield* Deferred.make<string, UserError>();
    const router = yield* HttpRouter.make;
    yield* router.add(
      "GET",
      "/callback",
      Effect.gen(function* () {
        const query = yield* HttpServerRequest.schemaSearchParams(
          Schema.Struct({
            state: Schema.String,
            code: Schema.optional(Schema.String),
            error: Schema.optional(Schema.String),
          }),
        );
        if (query.state !== expectedState || query.code === undefined) {
          yield* Deferred.fail(result, new UserError({ message: query.error ?? "invalid OAuth callback" }));
          return callbackPage("failure");
        }
        yield* Deferred.succeed(result, query.code);
        return callbackPage("done");
      }).pipe(
        Effect.catchTag("SchemaError", () =>
          Effect.as(
            Deferred.fail(result, new UserError({ message: "invalid OAuth callback" })),
            callbackPage("failure"),
          ),
        ),
      ),
    );
    const server = yield* NodeHttpServer.make(createServer, { host: "127.0.0.1", port: 0 }).pipe(
      Effect.mapError((cause) => new UserError({ message: `could not start OAuth callback: ${cause}` })),
    );
    yield* server.serve(router.asHttpEffect());
    if (server.address._tag !== "InetAddressV4") return yield* fail("could not bind OAuth callback server");
    return {
      redirectUri: `http://127.0.0.1:${server.address.port}/callback`,
      code: Deferred.await(result).pipe(
        Effect.timeoutOrElse({
          duration: CALLBACK_TIMEOUT_MS,
          orElse: () => fail("OAuth login timed out"),
        }),
      ),
    };
  });

/** How bp identifies itself to the auth server: a native client, not a throwaway loopback origin */
const CLIENT_ID = "com.blankparticle.bp";
const CLIENT_NAME = "bp";

const DeviceCodeResponse = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri_complete: Schema.String,
  expires_in: Schema.Number,
  interval: Schema.Number,
});
const TokenError = Schema.Struct({ error: Schema.String });

const authOrigin = () => process.env.BP_AUTH_URL ?? "https://auth.blankparticle.com";

/** Metadata every sign-in sends: who we are, and that the token is for the tools API (with the GitHub login) */
const identity = (resource: string) => ({
  client_id: CLIENT_ID,
  client_name: CLIENT_NAME,
  logo_uri: `${resource}/favicon.svg`,
  pii: "true",
  resource,
});

const store = (resource: string, tokens: { id_token: string; expires_in: number }) =>
  Effect.gen(function* () {
    const credentials: Credentials = { idToken: tokens.id_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
    yield* saveCredentials(resource, credentials);
    return credentials.idToken;
  });

/** Browser flow: a loopback listener catches the code the auth server sends back */
const loginWithBrowser = (resource: string, metadata: typeof Discovery.Type) =>
  Effect.scoped(
    Effect.gen(function* () {
      const verifier = randomBase64Url(32);
      const state = randomBase64Url(24);
      const challenge = yield* challengeFor(verifier);
      const listener = yield* callback(state);
      const authorization = new URL(metadata.authorization_endpoint);
      authorization.search = new URLSearchParams({
        client_type: "native",
        response_type: "code",
        redirect_uri: listener.redirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        ...identity(resource),
      }).toString();
      yield* Console.log(`Sign in at: ${authorization.toString()}`);
      yield* openBrowser(authorization.toString());
      yield* Console.log("Waiting for you to finish signing in…");
      const code = yield* listener.code;
      const tokens = yield* requestJson(
        TokenResponse,
        HttpClientRequest.post(metadata.token_endpoint).pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: "authorization_code",
            code,
            client_id: CLIENT_ID,
            redirect_uri: listener.redirectUri,
            code_verifier: verifier,
          }),
        ),
      );
      return yield* store(resource, tokens);
    }),
  );

/** Device flow (RFC 8628): show a code, poll until it is approved in any browser */
const loginWithDevice = (resource: string, metadata: typeof Discovery.Type) =>
  Effect.gen(function* () {
    if (metadata.device_authorization_endpoint === undefined)
      return yield* fail("the auth server does not support device sign-in");
    const device = yield* requestJson(
      DeviceCodeResponse,
      HttpClientRequest.post(metadata.device_authorization_endpoint).pipe(
        HttpClientRequest.bodyUrlParams(identity(resource)),
      ),
    );
    // No browser here — device sign-in is meant to be approved on another device
    yield* Console.log(`On any device, open: ${authOrigin()}/device`);
    yield* Console.log(`And enter the code: ${device.user_code}`);
    yield* Console.log("Waiting for you to approve the code…");
    const deadline = Date.now() + device.expires_in * 1000;
    let interval = device.interval;
    while (Date.now() < deadline) {
      yield* Effect.sleep(`${interval} seconds`);
      const response = yield* HttpClient.execute(
        HttpClientRequest.post(metadata.token_endpoint).pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: device.device_code,
            client_id: CLIENT_ID,
          }),
        ),
      ).pipe(Effect.mapError((cause) => new UserError({ message: `could not reach the auth server: ${cause}` })));
      if (response.status >= 200 && response.status < 300)
        return yield* store(resource, yield* HttpClientResponse.schemaBodyJson(TokenResponse)(response));
      const { error } = yield* HttpClientResponse.schemaBodyJson(TokenError)(response);
      if (error === "authorization_pending") continue;
      if (error === "slow_down") {
        interval += 5;
        continue;
      }
      if (error === "access_denied") return yield* fail("sign-in was denied");
      return yield* fail(
        `sign-in ${error === "expired_token" ? "expired" : `failed: ${error}`}; run \`bp login\` again`,
      );
    }
    return yield* fail("sign-in expired; run `bp login` again");
  });

export const login = (baseUrl: string, options: { device: boolean }) =>
  Effect.gen(function* () {
    const resource = new URL(baseUrl).origin;
    yield* Console.log(`Auth server: ${authOrigin()}`);
    const metadata = yield* requestJson(
      Discovery,
      HttpClientRequest.get(`${authOrigin()}/.well-known/openid-configuration`),
    );
    return yield* useDeviceLogin(options.device)
      ? loginWithDevice(resource, metadata)
      : loginWithBrowser(resource, metadata);
  });

export const accessToken = (baseUrl: string) =>
  Effect.gen(function* () {
    const credentials = yield* loadCredentials(new URL(baseUrl).origin);
    if (credentials === null) return yield* fail("not signed in; run `bp login`");
    if (credentials.expiresAt <= Date.now() + 30_000) return yield* fail("sign-in expired; run `bp login` again");
    return credentials.idToken;
  });

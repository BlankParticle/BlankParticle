import tanstackHandler from "@tanstack/react-start/server-entry";
import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { BrowserSession } from "../browser-session.ts";
import { WorkerEnv, WorkerExecutionContext } from "../context.ts";

export const PageRoutes = HttpRouter.add(
  "*",
  "/*",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const ctx = yield* WorkerExecutionContext;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const webRequest = yield* Effect.fromResult(HttpServerRequest.toWebResult(request));

    // Server functions are POSTs on our own origin; nobody else may drive them with the session cookie
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      const origin = request.headers.origin;
      if (origin !== undefined && origin !== new URL(request.originalUrl).origin)
        return HttpServerResponse.text("cross-origin request", { status: 403 });
    }

    // Looked up only when a server fn asks (assets and public pages never hit D1). The captured
    // context includes this request's scope, which stays open while TanStack handles the request.
    const session = yield* Effect.cached(BrowserSession);
    const services = yield* Effect.context<Effect.Services<typeof BrowserSession>>();
    const response = yield* Effect.tryPromise(() =>
      Promise.resolve(
        tanstackHandler.fetch(webRequest, {
          context: { cf: { env, ctx }, session: () => Effect.runPromiseWith(services)(session) },
        }),
      ),
    );
    return HttpServerResponse.fromWeb(response);
  }),
);

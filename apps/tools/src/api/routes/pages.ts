import tanstackHandler from "@tanstack/react-start/server-entry";
import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { WorkerEnv } from "#/lib/env.ts";

import { WorkerExecutionContext } from "../context.ts";
import { currentIdentity } from "../identity.ts";

export const PageRoutes = HttpRouter.add(
  "*",
  "/*",
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const ctx = yield* WorkerExecutionContext;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const webRequest = yield* Effect.fromResult(HttpServerRequest.toWebResult(request));
    const url = new URL(request.originalUrl);

    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      const origin = request.headers.origin;
      if (origin !== undefined && origin !== url.origin)
        return HttpServerResponse.text("cross-origin request", { status: 403 });
    }

    const identity = yield* currentIdentity;
    const login = identity?.allowed ? identity.login : undefined;
    const response = yield* Effect.tryPromise(() =>
      Promise.resolve(
        tanstackHandler.fetch(webRequest, {
          context: {
            cf: { env, ctx },
            user: login === undefined ? null : { login },
            denied: identity !== undefined && !identity.allowed ? (identity.email ?? identity.login) : null,
          },
        }),
      ),
    );
    return HttpServerResponse.fromWeb(response);
  }),
);

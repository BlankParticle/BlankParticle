import tanstackHandler from "@tanstack/react-start/server-entry";
import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

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
    const session = yield* BrowserSession;
    const response = yield* Effect.tryPromise(() =>
      Promise.resolve(tanstackHandler.fetch(webRequest, { context: { cf: { env, ctx }, session } })),
    );
    return HttpServerResponse.fromWeb(response);
  }),
);

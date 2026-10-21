import { Context, Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerRequest } from "effect/http";

import type { AuthAppEnv } from "../../alchemy.config.ts";
import { AuthDatabase, WorkerEnv, WorkerExecutionContext } from "./context.ts";
import { sweepExpired } from "./flow.ts";
import { AuthorizationRoutes } from "./routes/authorization.ts";
import { DiscoveryRoutes } from "./routes/discovery.ts";
import { PageRoutes } from "./routes/pages.ts";
import { SessionRoutes } from "./routes/sessions.ts";
import { TokenRoutes } from "./routes/tokens.ts";

/** Only what other origins call from the browser: the code exchange, session check/revoke and discovery */
const CROSS_ORIGIN_PATHS = /^\/(token$|session\/|\.well-known\/)/;

const cors = HttpMiddleware.cors({
  allowedHeaders: ["authorization", "content-type"],
  allowedMethods: ["GET", "POST", "OPTIONS"],
});

// Global so it also answers preflights, which no route matches
const Cors = HttpRouter.middleware(
  (httpEffect) =>
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
      CROSS_ORIGIN_PATHS.test(new URL(request.originalUrl).pathname) ? cors(httpEffect) : httpEffect,
    ),
  { global: true },
);

const Routes = Layer.mergeAll(AuthorizationRoutes, DiscoveryRoutes, SessionRoutes, TokenRoutes, PageRoutes, Cors);

const handler = HttpRouter.toWebHandler(Routes);

export default {
  fetch(request, env, ctx) {
    return handler.handler(request, Context.make(WorkerEnv, env).pipe(Context.add(WorkerExecutionContext, ctx)));
  },

  async scheduled(_event, env) {
    await Effect.runPromise(
      Effect.flatMap(AuthDatabase, sweepExpired).pipe(Effect.provideService(WorkerEnv, env), Effect.scoped),
    );
  },
} satisfies ExportedHandler<AuthAppEnv>;

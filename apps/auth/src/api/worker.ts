import { Context, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import type { AuthAppEnv } from "../../alchemy.config.ts";
import { WorkerEnv, WorkerExecutionContext } from "./context.ts";
import { AuthorizationRoutes } from "./routes/authorization.ts";
import { DiscoveryRoutes } from "./routes/discovery.ts";
import { PageRoutes } from "./routes/pages.ts";
import { SessionRoutes } from "./routes/sessions.ts";
import { TokenRoutes } from "./routes/tokens.ts";

const Routes = Layer.mergeAll(
  AuthorizationRoutes,
  DiscoveryRoutes,
  SessionRoutes,
  TokenRoutes,
  PageRoutes,
  HttpRouter.cors({
    allowedHeaders: ["authorization", "content-type"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
  }),
);

const handler = HttpRouter.toWebHandler(Routes);

export default {
  fetch(request, env, ctx) {
    return handler.handler(request, Context.make(WorkerEnv, env).pipe(Context.add(WorkerExecutionContext, ctx)));
  },
} satisfies ExportedHandler<AuthAppEnv>;

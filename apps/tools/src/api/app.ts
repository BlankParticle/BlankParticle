import { Layer } from "effect";
import { HttpRouter } from "effect/http";

import type { ToolsAppEnv } from "../../alchemy.config.ts";
import { WorkerEnv } from "../lib/env.ts";
import { HostDispatch } from "./middleware.ts";
import { ApiRoutes } from "./routes/api.ts";
import { AuthRoutes } from "./routes/auth.ts";
import { PageRoutes } from "./routes/pages.ts";

const Routes = Layer.mergeAll(ApiRoutes, AuthRoutes, PageRoutes, HostDispatch);

const makeHandler = (env: ToolsAppEnv) => HttpRouter.toWebHandler(Layer.provide(Routes, Layer.succeed(WorkerEnv, env)));

let cached: { env: ToolsAppEnv; handler: ReturnType<typeof makeHandler> } | undefined;

/**
 * One router per isolate, like the Effect runtime (`workerRuntime`): the bindings object is stable within an
 * isolate, and the API's auth middleware reads it once when the router is built. Routes still get it per request.
 */
export const toolsHandler = (env: ToolsAppEnv) => {
  if (cached?.env !== env) cached = { env, handler: makeHandler(env) };
  return cached.handler;
};

import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

import { respond } from "./errors.ts";
import { apiUser } from "./identity.ts";
import { HostDispatch } from "./middleware.ts";
import { AuthRoutes } from "./routes/auth.ts";
import { FileRoutes } from "./routes/files.ts";
import { PageRoutes } from "./routes/pages.ts";
import { SiteRoutes } from "./routes/sites.ts";

const Me = HttpRouter.add(
  "GET",
  "/api/me",
  respond(Effect.map(apiUser, (user) => HttpServerResponse.jsonUnsafe(user))),
);

const ApiRoutes = Layer.mergeAll(SiteRoutes, FileRoutes, Me);
const Routes = Layer.mergeAll(ApiRoutes, AuthRoutes, PageRoutes, HostDispatch);

export const toolsHandler = HttpRouter.toWebHandler(Routes);

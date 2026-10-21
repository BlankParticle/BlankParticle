import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api";

import { AuthorizationLive } from "../identity.ts";
import { BadRequest, CurrentUser, ToolsApi, Validation } from "../spec.ts";
import { FilesLive } from "./files.ts";
import { SitesLive } from "./sites.ts";

const AccountLive = HttpApiBuilder.group(ToolsApi, "account", (handlers) => handlers.handle("me", () => CurrentUser));

/** A request that fails its endpoint's schemas gets told why; a response that fails them stays a 500 */
const ValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(Validation, (error) =>
  error.kind === "Body" || error.kind === "ResponseHeaders"
    ? Effect.fail(error)
    : Effect.fail(new BadRequest({ message: `invalid ${error.kind.toLowerCase()}: ${error.cause.message}` })),
);

/** The JSON API defined in `spec.ts` */
export const ApiRoutes = HttpApiBuilder.layer(ToolsApi).pipe(
  Layer.provide([AccountLive, SitesLive, FilesLive]),
  Layer.provide([AuthorizationLive, ValidationLive]),
  Layer.provide(HttpServer.layerServices),
);

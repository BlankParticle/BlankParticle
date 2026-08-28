import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpServerResponse } from "effect/unstable/http";

export class ApiError extends Data.TaggedError("ApiError")<{
  status: 400 | 401 | 403 | 404;
  message: string;
}> {}

export const badRequest = (message: string) => new ApiError({ status: 400, message });
export const forbidden = new ApiError({ status: 403, message: "that site belongs to someone else" });
export const noSuchSite = new ApiError({ status: 404, message: "no such site" });
export const noSuchShare = new ApiError({ status: 404, message: "no such share" });

export const respond = <A, E, R>(effect: Effect.Effect<A, E | ApiError, R>) =>
  effect.pipe(
    Effect.catchIf(
      (error): error is ApiError => error instanceof ApiError,
      (error) => Effect.succeed(HttpServerResponse.jsonUnsafe({ error: error.message }, { status: error.status })),
    ),
    Effect.catchIf(Schema.isSchemaError, () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: "invalid request" }, { status: 400 })),
    ),
  );

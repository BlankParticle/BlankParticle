import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as Schema from "effect/Schema";

import { WorkerEnv } from "#/lib/env.ts";
import * as files from "#/lib/files.ts";
import { pathFrom } from "#/lib/store.ts";

import { ApiError, badRequest, noSuchFile, noSuchShare, respond } from "../errors.ts";
import { apiUser } from "../identity.ts";
import {
  DEFAULT_FILE_TTL_SECONDS,
  ManifestFile,
  MAX_BUNDLE_FILES,
  MAX_FILE_BYTES,
  MAX_FILE_TTL_SECONDS,
  MiB,
  SHARE_ID_PATTERN,
  Visibility,
  type User,
} from "../spec.ts";

const Ttl = Schema.optional(Schema.Union([Schema.Literal("never"), Schema.NumberFromString]));
const ShareId = Schema.String.check(Schema.isPattern(SHARE_ID_PATTERN));
const ShareParam = Schema.Struct({ id: ShareId });
const NameQuery = Schema.Struct({ name: Schema.String });
const Manifest = Schema.Struct({
  id: Schema.optional(ShareId),
  files: Schema.Array(ManifestFile).check(Schema.isMinLength(1), Schema.isMaxLength(MAX_BUNDLE_FILES)),
  ttl: Ttl,
  visibility: Schema.optional(Visibility),
});

const ttlSeconds = (ttl: "never" | number | undefined): Effect.Effect<number | null, ApiError> => {
  if (ttl === undefined) return Effect.succeed(DEFAULT_FILE_TTL_SECONDS);
  if (ttl === "never") return Effect.succeed(null);
  if (!Number.isFinite(ttl) || ttl <= 0) return Effect.fail(badRequest("ttl must be a positive number of seconds"));
  if (ttl > MAX_FILE_TTL_SECONDS) return Effect.fail(badRequest("ttl is longer than a year; use `never` instead"));
  return Effect.succeed(Math.floor(ttl));
};

const readableShare = (id: string, user: User) =>
  Effect.gen(function* () {
    const list = yield* files.uploadedFiles(id);
    const owner = list[0]?.owner;
    if (owner === undefined || (list[0]?.visibility === "private" && owner !== user.login)) return yield* noSuchShare;
    return list;
  });

const List = HttpRouter.add(
  "GET",
  "/api/files",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      return HttpServerResponse.jsonUnsafe(yield* files.listFiles(user.login));
    }),
  ),
);

const RegisterManifest = HttpRouter.add(
  "POST",
  "/api/files/manifest",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const env = yield* WorkerEnv;
      const manifest = yield* HttpServerRequest.schemaBodyJson(Manifest);
      const named = yield* Effect.forEach(manifest.files, (file) =>
        Effect.map(pathFrom(file.name), (name) => ({ ...file, name })),
      );
      if (new Set(named.map((file) => file.name)).size !== named.length)
        return yield* badRequest("duplicate file names");
      const oversized = named.find((file) => file.size > MAX_FILE_BYTES);
      if (oversized !== undefined)
        return yield* badRequest(
          `"${oversized.name}" is over ${MiB(MAX_FILE_BYTES)}, the most one upload request can carry`,
        );
      const result = yield* files
        .registerManifest({
          owner: user.login,
          id: manifest.id,
          files: named,
          ttl: yield* ttlSeconds(manifest.ttl),
          visibility: manifest.visibility ?? "public",
        })
        .pipe(Effect.catchTag("NoSuchShare", () => noSuchShare));
      return HttpServerResponse.jsonUnsafe({ ...result, url: `https://${env.ORIGINS.files}/${result.id}/` });
    }),
  ),
);

const Upload = HttpRouter.add(
  "PUT",
  "/api/files/:id/upload",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* HttpRouter.schemaPathParams(ShareParam);
      const query = yield* HttpServerRequest.schemaSearchParams(NameQuery);
      const { body } = yield* HttpServerRequest.toWeb(request);
      // the body streams into R2, so its size has to be known up front (no body at all is an empty file)
      const length = request.headers["content-length"];
      const size = length === undefined && body === null ? 0 : Number(length);
      if (!Number.isSafeInteger(size) || size < 0) return yield* badRequest("content-length is required");
      if (size > MAX_FILE_BYTES)
        return yield* badRequest(`file is over ${MiB(MAX_FILE_BYTES)}, the most one upload request can carry`);
      const name = yield* pathFrom(query.name);
      // a fixed-length stream is what R2 needs to accept a stream, and it fails the write if the body runs short or long
      const bytes = body === null ? null : body.pipeThrough(new FixedLengthStream(size));
      const record = yield* files.uploadFile(user.login, id, name, bytes, size).pipe(
        Effect.catchTag("NoSuchShare", () => noSuchShare),
        Effect.catchTag("NotInManifest", () =>
          badRequest(`"${name}" does not match the manifest (hash differs); send the manifest again`),
        ),
      );
      return HttpServerResponse.jsonUnsafe(record);
    }),
  ),
);

const Get = HttpRouter.add(
  "GET",
  "/api/files/:id",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { id } = yield* HttpRouter.schemaPathParams(ShareParam);
      return HttpServerResponse.jsonUnsafe(yield* readableShare(id, user));
    }),
  ),
);

const Download = HttpRouter.add(
  "GET",
  "/api/files/:id/download",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { id } = yield* HttpRouter.schemaPathParams(ShareParam);
      const query = yield* HttpServerRequest.schemaSearchParams(NameQuery);
      const list = yield* readableShare(id, user);
      const name = yield* pathFrom(query.name);
      const file = list.find((candidate) => candidate.name === name);
      const object = file === undefined ? null : yield* files.openFile(file);
      if (file === undefined || object === null) return yield* noSuchFile;
      return HttpServerResponse.fromWeb(
        new Response(object.body, {
          headers: { "content-type": file.type, "content-length": String(object.size), etag: object.httpEtag },
        }),
      );
    }),
  ),
);

const Delete = HttpRouter.add(
  "DELETE",
  "/api/files/:id",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { id } = yield* HttpRouter.schemaPathParams(ShareParam);
      yield* files.ownedShare(id, user.login);
      yield* files.deleteFile(id);
      return HttpServerResponse.empty();
    }),
  ),
);

export const FileRoutes = Layer.mergeAll(List, RegisterManifest, Upload, Get, Download, Delete);

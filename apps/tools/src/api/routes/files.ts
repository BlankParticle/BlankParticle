import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { WorkerEnv } from "#/lib/env.ts";
import * as files from "#/lib/files.ts";
import { pathFrom } from "#/lib/store.ts";

import { badRequest, noSuchFile, noSuchShare } from "../errors.ts";
import {
  CurrentUser,
  DEFAULT_FILE_TTL_SECONDS,
  MAX_FILE_BYTES,
  MAX_FILE_TTL_SECONDS,
  MiB,
  ToolsApi,
  type Manifest,
  type User,
} from "../spec.ts";

const ttlSeconds = (ttl: Manifest["ttl"]) => {
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

export const FilesLive = HttpApiBuilder.group(ToolsApi, "files", (handlers) =>
  handlers
    .handle("list", () => Effect.flatMap(CurrentUser, (user) => files.listFiles(user.login)))
    .handle("registerManifest", ({ payload: manifest }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const env = yield* WorkerEnv;
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
        return { ...result, url: `https://${env.ORIGINS.files}/${result.id}/` };
      }),
    )
    .handle("upload", ({ params: { id }, query, request }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const { body } = yield* Effect.orDie(HttpServerRequest.toWeb(request));
        // the body streams into R2, so its size has to be known up front (no body at all is an empty file)
        const length = request.headers["content-length"];
        const size = length === undefined && body === null ? 0 : Number(length);
        if (!Number.isSafeInteger(size) || size < 0) return yield* badRequest("content-length is required");
        if (size > MAX_FILE_BYTES)
          return yield* badRequest(`file is over ${MiB(MAX_FILE_BYTES)}, the most one upload request can carry`);
        const name = yield* pathFrom(query.name);
        // a fixed-length stream is what R2 needs to accept a stream, and it fails the write if the body runs short or long
        const bytes = body === null ? null : body.pipeThrough(new FixedLengthStream(size));
        return yield* files.uploadFile(user.login, id, name, bytes, size).pipe(
          Effect.catchTag("NoSuchShare", () => noSuchShare),
          Effect.catchTag("NotInManifest", () =>
            badRequest(`"${name}" does not match the manifest (hash differs); send the manifest again`),
          ),
        );
      }),
    )
    .handle("get", ({ params }) => Effect.flatMap(CurrentUser, (user) => readableShare(params.id, user)))
    .handle("download", ({ params, query }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const list = yield* readableShare(params.id, user);
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
    )
    .handle("delete", ({ params }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        yield* files.ownedShare(params.id, user.login);
        yield* files.deleteFile(params.id);
      }),
    ),
);

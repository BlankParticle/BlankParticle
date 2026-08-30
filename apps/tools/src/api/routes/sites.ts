import { Effect, Layer } from "effect";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import {
  deleteFile,
  deleteSite,
  getFile,
  getSite,
  listFiles,
  listSites,
  normalizePath,
  putFile,
  saveSite,
  syncFiles,
  touchSite,
} from "#/lib/store.ts";

import { ApiError, badRequest, forbidden, noSuchSite, respond } from "../errors.ts";
import { apiUser } from "../identity.ts";
import { isMarkdown, isValidSlug, MAX_SITE_FILE_BYTES, MiB, Slug, Visibility, type Site, type User } from "../spec.ts";

const SlugParam = Schema.Struct({ slug: Slug });
const FileQuery = Schema.Struct({ path: Schema.String });
const ContentType = Schema.String.check(Schema.isPattern(/^[\w.+-]+\/[\w.+-]+(;[\w\s=.+-]*)?$/));

const readableSite = (slug: string, user: User): Effect.Effect<Site, ApiError, import("#/lib/env.ts").WorkerEnv> =>
  Effect.gen(function* () {
    const site = yield* getSite(slug);
    if (site === null || (site.visibility === "private" && site.owner !== user.login)) return yield* noSuchSite;
    return site;
  });

const ownedSite = (slug: string, user: User) =>
  Effect.gen(function* () {
    const site = yield* getSite(slug);
    if (site === null) return yield* noSuchSite;
    if (site.owner !== user.login) return yield* forbidden;
    return site;
  });

const pathFrom = (path: string) => {
  const normalized = normalizePath(path);
  return normalized === null ? Effect.fail(badRequest("invalid file path")) : Effect.succeed(normalized);
};

const List = HttpRouter.add(
  "GET",
  "/api/sites",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      return HttpServerResponse.jsonUnsafe(yield* listSites(user.login));
    }),
  ),
);

const Get = HttpRouter.add(
  "GET",
  "/api/sites/:slug",
  respond(
    Effect.gen(function* () {
      const { slug } = yield* HttpRouter.schemaPathParams(SlugParam);
      const site = yield* getSite(slug);
      if (site === null) return yield* noSuchSite;
      return HttpServerResponse.jsonUnsafe({ site, files: yield* listFiles(slug) });
    }),
  ),
);

const Put = HttpRouter.add(
  "PUT",
  "/api/sites/:slug",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { slug } = yield* HttpRouter.schemaPathParams(SlugParam);
      const { visibility } = yield* HttpServerRequest.schemaBodyJson(
        Schema.Struct({ visibility: Schema.optional(Visibility) }),
      );
      if (!isValidSlug(slug)) return yield* badRequest(`"${slug}" is not a valid site name`);
      const existing = yield* getSite(slug);
      if (existing !== null && existing.owner !== user.login) return yield* forbidden;
      return HttpServerResponse.jsonUnsafe(yield* saveSite(existing, slug, user.login, visibility));
    }),
  ),
);

const Delete = HttpRouter.add(
  "DELETE",
  "/api/sites/:slug",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { slug } = yield* HttpRouter.schemaPathParams(SlugParam);
      yield* ownedSite(slug, user);
      yield* deleteSite(slug);
      return HttpServerResponse.empty();
    }),
  ),
);

const PutFile = HttpRouter.add(
  "PUT",
  "/api/sites/:slug/files",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const { slug } = yield* HttpRouter.schemaPathParams(SlugParam);
      const query = yield* HttpServerRequest.schemaSearchParams(
        Schema.Struct({ path: Schema.String, type: Schema.optional(ContentType) }),
      );
      yield* ownedSite(slug, user);
      const path = yield* pathFrom(query.path);
      const bytes = new Uint8Array(yield* request.arrayBuffer);
      if (bytes.byteLength > MAX_SITE_FILE_BYTES)
        return yield* badRequest(
          `"${path}" is over ${MiB(MAX_SITE_FILE_BYTES)}, the most a site page can be (the KV limit). Share it with \`bp file upload\` instead.`,
        );
      const type = query.type ?? (isMarkdown(path) ? "text/markdown; charset=utf-8" : "application/octet-stream");
      return HttpServerResponse.jsonUnsafe(yield* putFile(slug, path, bytes, type));
    }),
  ),
);

const GetFile = HttpRouter.add(
  "GET",
  "/api/sites/:slug/files",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { slug } = yield* HttpRouter.schemaPathParams(SlugParam);
      const query = yield* HttpServerRequest.schemaSearchParams(FileQuery);
      yield* readableSite(slug, user);
      const path = yield* pathFrom(query.path);
      const file = yield* getFile(slug, path);
      if (file === null) return yield* new ApiError({ status: 404, message: "no such file" });
      return HttpServerResponse.uint8Array(new Uint8Array(file.value), {
        headers: { "content-type": file.meta.type, etag: `"${file.meta.etag}"` },
      });
    }),
  ),
);

const DeleteFile = HttpRouter.add(
  "DELETE",
  "/api/sites/:slug/files",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { slug } = yield* HttpRouter.schemaPathParams(SlugParam);
      const query = yield* HttpServerRequest.schemaSearchParams(FileQuery);
      yield* ownedSite(slug, user);
      yield* deleteFile(slug, yield* pathFrom(query.path));
      return HttpServerResponse.empty();
    }),
  ),
);

const Sync = HttpRouter.add(
  "POST",
  "/api/sites/:slug/sync",
  respond(
    Effect.gen(function* () {
      const user = yield* apiUser;
      const { slug } = yield* HttpRouter.schemaPathParams(SlugParam);
      const { keep } = yield* HttpServerRequest.schemaBodyJson(Schema.Struct({ keep: Schema.Array(Schema.String) }));
      const site = yield* ownedSite(slug, user);
      const removed = yield* syncFiles(slug, keep);
      yield* touchSite(site);
      return HttpServerResponse.jsonUnsafe({ removed });
    }),
  ),
);

export const SiteRoutes = Layer.mergeAll(List, Get, Put, Delete, PutFile, GetFile, DeleteFile, Sync);

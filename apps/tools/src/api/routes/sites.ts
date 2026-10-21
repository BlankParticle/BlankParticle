import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import {
  deleteFile,
  deleteSite,
  getFile,
  getSite,
  listFiles,
  listSites,
  ownedSite,
  pathFrom,
  putFile,
  readableSite,
  saveSite,
  syncFiles,
  touchSite,
} from "#/lib/store.ts";

import { badRequest, forbidden, noSuchFile } from "../errors.ts";
import { CurrentUser, isMarkdown, isValidSlug, MAX_SITE_FILE_BYTES, MiB, ToolsApi } from "../spec.ts";

export const SitesLive = HttpApiBuilder.group(ToolsApi, "sites", (handlers) =>
  handlers
    .handle("list", () => Effect.flatMap(CurrentUser, (user) => listSites(user.login)))
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const site = yield* readableSite(params.slug, user.login);
        return { site, files: yield* listFiles(params.slug) };
      }),
    )
    .handle("put", ({ params: { slug }, payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        if (!isValidSlug(slug)) return yield* badRequest(`"${slug}" is not a valid site name`);
        const existing = yield* getSite(slug);
        if (existing !== null && existing.owner !== user.login) return yield* forbidden("site");
        return yield* saveSite(existing, slug, user.login, payload.visibility);
      }),
    )
    .handle("delete", ({ params }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        yield* ownedSite(params.slug, user.login);
        yield* deleteSite(params.slug);
      }),
    )
    .handle("putFile", ({ params, query, request }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        yield* ownedSite(params.slug, user.login);
        const path = yield* pathFrom(query.path);
        // KV metadata needs the hash before the write, so the body is buffered; an announced oversized one is refused
        // unread, and a chunked one once it's in
        const oversized = badRequest(
          `"${path}" is over ${MiB(MAX_SITE_FILE_BYTES)}, the most a site page can be (the KV limit). Share it with \`bp file upload\` instead.`,
        );
        if (Number(request.headers["content-length"] ?? 0) > MAX_SITE_FILE_BYTES) return yield* oversized;
        const bytes = new Uint8Array(yield* Effect.orDie(request.arrayBuffer));
        if (bytes.byteLength > MAX_SITE_FILE_BYTES) return yield* oversized;
        const type = query.type ?? (isMarkdown(path) ? "text/markdown; charset=utf-8" : "application/octet-stream");
        return yield* putFile(params.slug, path, bytes, type);
      }),
    )
    .handle("getFile", ({ params, query }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        yield* readableSite(params.slug, user.login);
        const file = yield* getFile(params.slug, yield* pathFrom(query.path));
        if (file === null) return yield* noSuchFile;
        return HttpServerResponse.uint8Array(new Uint8Array(file.value), {
          headers: { "content-type": file.meta.type, etag: `"${file.meta.etag}"` },
        });
      }),
    )
    .handle("deleteFile", ({ params, query }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        yield* ownedSite(params.slug, user.login);
        yield* deleteFile(params.slug, yield* pathFrom(query.path));
      }),
    )
    .handle("sync", ({ params, payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        yield* ownedSite(params.slug, user.login);
        const removed = yield* syncFiles(params.slug, payload.keep);
        yield* touchSite(params.slug);
        return { removed };
      }),
    ),
);

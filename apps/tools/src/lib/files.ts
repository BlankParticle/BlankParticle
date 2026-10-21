import { and, desc, eq, gt, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

import { forbidden, noSuchShare } from "../api/errors.ts";
import type { Viewer } from "../api/identity.ts";
import { isBundleId, type ManifestFile, type SharedFile, type Visibility } from "../api/spec.ts";
import { query, rowChunks, runBatch } from "../db/index.ts";
import { shareFiles, shares, type ShareFileRow, type ShareRow } from "../db/schema.ts";
import { WorkerEnv } from "./env.ts";
import { listingPage } from "./listing.ts";
import { interstitial } from "./not-found.ts";

/**
 * Shares, manifest first: the client declares its files (name, size, type, sha256), the server mints the share
 * (`b-` prefixed for bundles) and one pending file row each, then the bytes arrive one file at a time and must
 * hash to what was declared. Objects live in R2 at `<share>/<name>`. Pending files are invisible everywhere and
 * swept with their share after a day; expiry is enforced on read and swept by the cron.
 */

/** A manifest that names a share you don't own (or that doesn't exist) */
export class NoSuchShare extends Data.TaggedError("NoSuchShare") {}
/** Bytes arrived for a name the manifest doesn't know, or that hash differently */
export class NotInManifest extends Data.TaggedError("NotInManifest") {}

const PENDING_TTL = 24 * 60 * 60 * 1000;

const hex = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const newId = (bundle: boolean) => (bundle ? `b-${hex()}` : hex());

/** Percent-encode a stored name segment by segment so folders stay folders in the URL */
const encodePath = (name: string) => name.split("/").map(encodeURIComponent).join("/");

const toSharedFile = (env: { ORIGINS: { files: string } }, share: ShareRow, file: ShareFileRow): SharedFile => ({
  id: share.id,
  name: file.name,
  owner: share.owner,
  size: file.size,
  type: file.type,
  uploadedAt: file.uploadedAt ?? share.createdAt,
  expiresAt: share.expiresAt,
  visibility: share.visibility,
  url: `https://${env.ORIGINS.files}/${share.visibility === "private" ? "private/" : ""}${share.id}/${encodePath(file.name)}`,
});

const isExpired = (record: { expiresAt: number | null }, now = Date.now()) =>
  record.expiresAt !== null && record.expiresAt <= now;

const getShare = (id: string) => query((d) => d.select().from(shares).where(eq(shares.id, id)).get());
const filesOf = (id: string) =>
  query((d) => d.select().from(shareFiles).where(eq(shareFiles.shareId, id)).orderBy(shareFiles.name));

/** The share, uploaded or not, provided `login` owns it */
export const ownedShare = (id: string, login: string) =>
  Effect.gen(function* () {
    const share = yield* getShare(id);
    if (share === undefined) return yield* noSuchShare;
    if (share.owner !== login) return yield* forbidden("share");
    return share;
  });

// ─── Manifest → pending files ────────────────────────────────────────────

export type ManifestResult = { id: string; files: Array<{ name: string; uploaded: boolean }> };

/**
 * Registers what is about to be uploaded. A new manifest mints a share; a manifest naming an existing share
 * (resume) keeps every file whose name and hash already landed and re-registers the rest as pending.
 */
export const registerManifest = (options: {
  owner: string;
  id?: string | undefined;
  files: ReadonlyArray<ManifestFile>;
  /** seconds; null = never */
  ttl: number | null;
  visibility: Visibility;
}) =>
  Effect.gen(function* () {
    const now = Date.now();
    const existing = options.id === undefined ? undefined : yield* getShare(options.id);
    if (options.id !== undefined && existing?.owner !== options.owner) return yield* new NoSuchShare();
    const share: ShareRow = existing ?? {
      id: newId(options.files.length > 1),
      owner: options.owner,
      visibility: options.visibility,
      createdAt: now,
      expiresAt: options.ttl === null ? null : now + options.ttl * 1000,
    };
    const done = new Map(
      (existing === undefined ? [] : yield* filesOf(share.id))
        .filter((file) => file.uploadedAt !== null)
        .map((file) => [file.name, file.hash]),
    );
    const pending = options.files.filter((file) => done.get(file.name) !== file.hash);
    // the share and its pending rows land together; a re-declared name replaces its old row
    yield* query((d) =>
      runBatch(d, [
        ...(existing === undefined ? [d.insert(shares).values(share)] : []),
        ...rowChunks(pending, 6).map((chunk) =>
          d
            .insert(shareFiles)
            .values(
              chunk.map((file) => ({
                shareId: share.id,
                name: file.name,
                size: file.size,
                type: file.type,
                hash: file.hash,
                uploadedAt: null,
              })),
            )
            .onConflictDoUpdate({
              target: [shareFiles.shareId, shareFiles.name],
              set: {
                size: sql`excluded.size`,
                type: sql`excluded.type`,
                hash: sql`excluded.hash`,
                uploadedAt: null,
              },
            }),
        ),
      ]),
    );
    const result: ManifestResult = {
      id: share.id,
      files: options.files.map((file) => ({ name: file.name, uploaded: done.get(file.name) === file.hash })),
    };
    return result;
  });

/**
 * The bytes for one manifest entry, streamed straight into R2. They must be the declared size, and R2 rejects the
 * write unless they hash to the declared sha256.
 */
export const uploadFile = (owner: string, id: string, name: string, body: ReadableStream | null, size: number) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const row = yield* query((d) =>
      d
        .select({ share: shares, file: shareFiles })
        .from(shareFiles)
        .innerJoin(shares, eq(shareFiles.shareId, shares.id))
        .where(and(eq(shareFiles.shareId, id), eq(shareFiles.name, name)))
        .get(),
    );
    if (row === undefined || row.share.owner !== owner) return yield* new NoSuchShare();
    if (size !== row.file.size) return yield* new NotInManifest();
    yield* Effect.tryPromise({
      try: () =>
        env.FILES.put(`${id}/${name}`, body, { httpMetadata: { contentType: row.file.type }, sha256: row.file.hash }),
      catch: (cause) => cause,
    }).pipe(
      Effect.catch((cause) =>
        /checksum|sha-?256|digest/i.test(String(cause)) ? new NotInManifest() : Effect.die(cause),
      ),
    );
    const landed = { size, uploadedAt: Date.now() };
    yield* query((d) =>
      d
        .update(shareFiles)
        .set(landed)
        .where(and(eq(shareFiles.shareId, id), eq(shareFiles.name, name))),
    );
    return toSharedFile(env, row.share, { ...row.file, ...landed });
  });

// ─── Reading ─────────────────────────────────────────────────────────────

const uploaded = (where: SQL | undefined, order: SQL | SQLiteColumn) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const rows = yield* query((d) =>
      d
        .select({ share: shares, file: shareFiles })
        .from(shareFiles)
        .innerJoin(shares, eq(shareFiles.shareId, shares.id))
        .where(and(where, isNotNull(shareFiles.uploadedAt)))
        .orderBy(order),
    );
    return rows.map((row) => toSharedFile(env, row.share, row.file));
  });

/** Everything uploaded and unexpired that `owner` shared */
export const listFiles = (owner: string) =>
  uploaded(
    and(eq(shares.owner, owner), or(isNull(shares.expiresAt), gt(shares.expiresAt, Date.now()))),
    desc(shareFiles.uploadedAt),
  );

/** Every uploaded file of a share (empty when there is no such share) */
export const uploadedFiles = (id: string) => uploaded(eq(shareFiles.shareId, id), shareFiles.name);

/** One uploaded file, or null when there is no such file or its bytes never arrived */
const uploadedFile = (id: string, name: string) =>
  Effect.map(
    uploaded(and(eq(shareFiles.shareId, id), eq(shareFiles.name, name)), shareFiles.name),
    (files) => files[0] ?? null,
  );

/** The object behind a file record; null if R2 lost it */
export const openFile = (file: SharedFile) =>
  Effect.flatMap(WorkerEnv, (env) => Effect.promise(() => env.FILES.get(`${file.id}/${file.name}`)));

// ─── Removal ─────────────────────────────────────────────────────────────

/** Removes the whole share: every object under `<id>/` and the rows (files cascade). Returns how many files it had. */
export const deleteFile = (id: string) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const files = yield* filesOf(id);
    const objects = files.filter((file) => file.uploadedAt !== null).map((file) => `${id}/${file.name}`);
    if (objects.length > 0) yield* Effect.promise(() => env.FILES.delete(objects));
    yield* query((d) => d.delete(shares).where(eq(shares.id, id)));
    return files.length;
  });

/** Cron: expired shares go, and manifests nobody finished within a day. Returns how many files were removed. */
export const purgeExpired = Effect.gen(function* () {
  const now = Date.now();
  const [expired, unfinished] = yield* Effect.all(
    [
      query((d) => d.select({ id: shares.id }).from(shares).where(lte(shares.expiresAt, now))),
      query((d) =>
        d
          .select({ id: shares.id })
          .from(shares)
          .where(lt(shares.createdAt, now - PENDING_TTL))
          .innerJoin(shareFiles, and(eq(shareFiles.shareId, shares.id), isNull(shareFiles.uploadedAt))),
      ),
    ],
    { concurrency: "unbounded" },
  );
  const ids = [...new Set([...expired, ...unfinished].map((row) => row.id))];
  const removed = yield* Effect.forEach(ids, deleteFile, { concurrency: 10 });
  return removed.reduce((sum, count) => sum + count, 0);
});

// ─── Serving ─────────────────────────────────────────────────────────────

/** Private shares are for their owner: null when the viewer is them, otherwise the page explaining why not */
const ownerOnly = (request: Request, owner: string, viewer: Effect.Effect<Viewer>) =>
  Effect.gen(function* () {
    const { signedIn, login } = yield* viewer;
    return login === owner ? null : yield* interstitial(request, signedIn ? "files" : "private");
  });

/** Everything a viewer is allowed to see of a share: its files, or the page explaining why not */
const visibleFiles = (request: Request, id: string, visibility: Visibility, viewer: Effect.Effect<Viewer>) =>
  Effect.gen(function* () {
    const now = Date.now();
    const files = (yield* uploadedFiles(id)).filter((file) => file.visibility === visibility && !isExpired(file, now));
    const owner = files[0]?.owner;
    if (owner === undefined) return yield* interstitial(request, "files");
    if (visibility === "private") {
      const refused = yield* ownerOnly(request, owner, viewer);
      if (refused !== null) return refused;
    }
    return files;
  });

/**
 * `/<id>/`: a bundle shows its folder; a single-file share is just the file, there is no folder to explore.
 * `viewer` is only resolved for private shares.
 */
export const serveBundle = (request: Request, id: string, visibility: Visibility, viewer: Effect.Effect<Viewer>) =>
  Effect.flatMap(visibleFiles(request, id, visibility, viewer), (files) => {
    if (files instanceof Response) return Effect.succeed(files);
    const [only] = files;
    if (!isBundleId(id) && only !== undefined) return serveObject(request, only);
    return Effect.succeed(listingPage({ host: new URL(request.url).host, id, files }));
  });

/**
 * Serves `/<id>/<name>` from R2; expired shares are deleted on the spot.
 * Private files are visible only to their owner (signed in through auth.blankparticle.com).
 */
export const serveFile = (
  request: Request,
  id: string,
  name: string,
  visibility: Visibility,
  viewer: Effect.Effect<Viewer>,
) =>
  Effect.gen(function* () {
    const file = yield* uploadedFile(id, name);
    if (file === null || file.visibility !== visibility) return yield* interstitial(request, "files");
    if (isExpired(file)) {
      yield* deleteFile(id);
      return yield* interstitial(request, "files");
    }
    if (file.visibility === "private") {
      const refused = yield* ownerOnly(request, file.owner, viewer);
      if (refused !== null) return refused;
    }
    return yield* serveObject(request, file);
  });

const encodeFilename = (name: string) =>
  `filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;

/**
 * A single `bytes=` range of a `size`-byte file. Undefined serves the whole file (no header, several ranges, or
 * one that doesn't parse, all of which a server may ignore); "unsatisfiable" starts past the end.
 */
const byteRange = (header: string | null, size: number) => {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return undefined;
  const [, start = "", end = ""] = match;
  if (start === "") {
    if (end === "") return undefined;
    const length = Math.min(Number(end), size);
    return length === 0 ? "unsatisfiable" : { offset: size - length, length };
  }
  const offset = Number(start);
  if (offset >= size) return "unsatisfiable";
  const last = end === "" ? size - 1 : Math.min(Number(end), size - 1);
  return last < offset ? undefined : { offset, length: last - offset + 1 };
};

/**
 * The bytes of a file the viewer may see. HEAD is a metadata lookup; GET hands R2 the request's conditional
 * headers (a failed precondition comes back without a body: 304 or 412) and a single byte range (206).
 * `If-Range` isn't checked, so a request carrying one gets the whole file.
 */
const serveObject = (request: Request, file: SharedFile) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const key = `${file.id}/${file.name}`;
    const remaining = file.expiresAt === null ? Infinity : Math.floor((file.expiresAt - Date.now()) / 1000);
    const headers = new Headers({
      "content-type": file.type,
      "content-disposition": `${request.url.includes("?download") ? "attachment" : "inline"}; ${encodeFilename(file.name)}`,
      "cache-control":
        file.visibility === "private" ? "private, no-store" : `public, max-age=${Math.min(3600, remaining)}`,
      "accept-ranges": "bytes",
      "x-content-type-options": "nosniff",
    });
    if (file.expiresAt !== null) headers.set("expires", new Date(file.expiresAt).toUTCString());

    if (request.method === "HEAD") {
      const object = yield* Effect.promise(() => env.FILES.head(key));
      if (object === null) return yield* interstitial(request, "files");
      headers.set("etag", object.httpEtag);
      headers.set("content-length", String(object.size));
      const fresh = request.headers.get("if-none-match") === object.httpEtag;
      return new Response(null, { status: fresh ? 304 : 200, headers });
    }

    const range = request.headers.has("if-range") ? undefined : byteRange(request.headers.get("range"), file.size);
    if (range === "unsatisfiable") {
      headers.set("content-range", `bytes */${file.size}`);
      return new Response(null, { status: 416, headers });
    }
    const object = yield* Effect.promise(() =>
      env.FILES.get(key, { onlyIf: request.headers, ...(range !== undefined && { range }) }),
    );
    if (object === null) return yield* interstitial(request, "files");
    headers.set("etag", object.httpEtag);
    if (!("body" in object)) {
      const revalidating = request.headers.has("if-none-match") || request.headers.has("if-modified-since");
      return new Response(null, { status: revalidating ? 304 : 412, headers });
    }
    if (range === undefined) {
      headers.set("content-length", String(object.size));
      return new Response(object.body, { status: 200, headers });
    }
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set("content-length", String(range.length));
    return new Response(object.body, { status: 206, headers });
  });

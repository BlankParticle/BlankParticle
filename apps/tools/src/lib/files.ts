import { and, desc, eq, gt, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import * as Effect from "effect/Effect";

import { isBundleId, type SharedFile, type ManifestFile, type Visibility } from "../api/spec.ts";
import { query } from "../db/index.ts";
import { shareFiles, shares, type ShareFileRow, type ShareRow } from "../db/schema.ts";
import { WorkerEnv } from "./env.ts";
import { listingPage } from "./listing.ts";
import { sitePage } from "./not-found.ts";

/**
 * Shares, manifest first: the client declares its files (name, size, type, sha256), the server mints the share
 * (`b-` prefixed for bundles) and one pending file row each, then the bytes arrive one file at a time and must
 * hash to what was declared. Objects live in R2 at `<share>/<name>`. Pending files are invisible everywhere and
 * swept with their share after a day; expiry is enforced on read and swept by the cron.
 */

/** A manifest that names a share you don't own (or that doesn't exist) */
export class NoSuchShare extends Error {
  readonly _tag = "NoSuchShare";
}
/** Bytes arrived for a name the manifest doesn't know, or that hash differently */
export class NotInManifest extends Error {
  readonly _tag = "NotInManifest";
}

const PENDING_TTL = 24 * 60 * 60 * 1000;

const hex = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const newId = (bundle: boolean) => (bundle ? `b-${hex()}` : hex());

export const sha256 = (bytes: Uint8Array) =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  });

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

export const isExpired = (record: { expiresAt: number | null }, now = Date.now()) =>
  record.expiresAt !== null && record.expiresAt <= now;

const getShare = (id: string) => query((d) => d.select().from(shares).where(eq(shares.id, id)).get());
const filesOf = (id: string) =>
  query((d) => d.select().from(shareFiles).where(eq(shareFiles.shareId, id)).orderBy(shareFiles.name));

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
    if (options.id !== undefined && existing?.owner !== options.owner) return yield* Effect.fail(new NoSuchShare());
    const share: ShareRow = existing ?? {
      id: newId(options.files.length > 1),
      owner: options.owner,
      visibility: options.visibility,
      createdAt: now,
      expiresAt: options.ttl === null ? null : now + options.ttl * 1000,
    };
    if (existing === undefined) yield* query((d) => d.insert(shares).values(share));
    const done = new Map(
      (existing === undefined ? [] : yield* filesOf(share.id))
        .filter((file) => file.uploadedAt !== null)
        .map((file) => [file.name, file.hash]),
    );
    const files = options.files.map((file) => ({ name: file.name, uploaded: done.get(file.name) === file.hash }));
    for (const file of options.files) {
      if (done.get(file.name) === file.hash) continue;
      const fresh = { size: file.size, type: file.type, hash: file.hash, uploadedAt: null };
      yield* query((d) =>
        d
          .insert(shareFiles)
          .values({ shareId: share.id, name: file.name, ...fresh })
          .onConflictDoUpdate({ target: [shareFiles.shareId, shareFiles.name], set: fresh }),
      );
    }
    const result: ManifestResult = { id: share.id, files };
    return result;
  });

/** The bytes for one manifest entry; they must hash to what was declared */
export const uploadFile = (owner: string, id: string, name: string, bytes: Uint8Array) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const share = yield* getShare(id);
    if (share === undefined || share.owner !== owner) return yield* Effect.fail(new NoSuchShare());
    const file = yield* query((d) =>
      d
        .select()
        .from(shareFiles)
        .where(and(eq(shareFiles.shareId, id), eq(shareFiles.name, name)))
        .get(),
    );
    if (file === undefined) return yield* Effect.fail(new NoSuchShare());
    if ((yield* sha256(bytes)) !== file.hash) return yield* Effect.fail(new NotInManifest());
    yield* Effect.promise(() => env.FILES.put(`${id}/${name}`, bytes, { httpMetadata: { contentType: file.type } }));
    const landed = { size: bytes.byteLength, uploadedAt: Date.now() };
    yield* query((d) =>
      d
        .update(shareFiles)
        .set(landed)
        .where(and(eq(shareFiles.shareId, id), eq(shareFiles.name, name))),
    );
    return toSharedFile(env, share, { ...file, ...landed });
  });

// ─── Reading ─────────────────────────────────────────────────────────────

/** The object plus its record, or null when either is missing or the bytes never arrived */
export const getFile = (id: string, name: string) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const row = yield* query((d) =>
      d
        .select({ share: shares, file: shareFiles })
        .from(shareFiles)
        .innerJoin(shares, eq(shareFiles.shareId, shares.id))
        .where(and(eq(shareFiles.shareId, id), eq(shareFiles.name, name), isNotNull(shareFiles.uploadedAt)))
        .get(),
    );
    if (row === undefined) return null;
    const object = yield* Effect.promise(() => env.FILES.get(`${id}/${name}`));
    return object === null ? null : { object, record: toSharedFile(env, row.share, row.file) };
  });

/** Everything uploaded and unexpired that `owner` shared */
export const listFiles = (owner: string) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const rows = yield* query((d) =>
      d
        .select({ share: shares, file: shareFiles })
        .from(shareFiles)
        .innerJoin(shares, eq(shareFiles.shareId, shares.id))
        .where(
          and(
            eq(shares.owner, owner),
            isNotNull(shareFiles.uploadedAt),
            or(isNull(shares.expiresAt), gt(shares.expiresAt, Date.now())),
          ),
        )
        .orderBy(desc(shareFiles.uploadedAt)),
    );
    return rows.map((row) => toSharedFile(env, row.share, row.file));
  });

/** Every uploaded file of a share (empty when there is no such share) */
export const findFile = (id: string) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const share = yield* getShare(id);
    if (share === undefined) return [];
    const files = yield* filesOf(id);
    return files.filter((file) => file.uploadedAt !== null).map((file) => toSharedFile(env, share, file));
  });

/** Whoever owns the share, uploaded or not; for authorising deletes */
export const ownerOf = (id: string) => Effect.map(getShare(id), (share) => share?.owner ?? null);

// ─── Removal ─────────────────────────────────────────────────────────────

/** Removes the whole share: every object under `<id>/` and the rows (files cascade) */
export const deleteFile = (id: string) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const files = yield* filesOf(id);
    const objects = files.filter((file) => file.uploadedAt !== null).map((file) => `${id}/${file.name}`);
    if (objects.length > 0) yield* Effect.promise(() => env.FILES.delete(objects));
    yield* query((d) => d.delete(shares).where(eq(shares.id, id)));
  });

/** Cron: expired shares go, and manifests nobody finished within a day. Returns how many files were removed. */
export const purgeExpired = Effect.gen(function* () {
  const now = Date.now();
  const unfinished = query((d) =>
    d
      .select({ id: shares.id })
      .from(shares)
      .where(lt(shares.createdAt, now - PENDING_TTL))
      .innerJoin(shareFiles, and(eq(shareFiles.shareId, shares.id), isNull(shareFiles.uploadedAt))),
  );
  const expired = query((d) => d.select({ id: shares.id }).from(shares).where(lte(shares.expiresAt, now)));
  const ids = [...new Set([...(yield* expired), ...(yield* unfinished)].map((row) => row.id))];
  let removed = 0;
  for (const id of ids) {
    removed += (yield* filesOf(id)).length;
    yield* deleteFile(id);
  }
  return removed;
});

// ─── Serving ─────────────────────────────────────────────────────────────

/** Who is looking: `login` is the allow-listed owner identity if any; `signedIn` covers any valid session */
export type Viewer = { signedIn: boolean; login: string | undefined };

/** The interstitials for the files host; `private` carries the sign-in link (a button, never a redirect) */
const interstitial = (request: Request, kind: "files" | "private") =>
  Effect.map(WorkerEnv, (env) => {
    const signIn = new URL(`https://${env.ORIGINS.tools}/auth/login`);
    signIn.searchParams.set("return_to", request.url);
    return sitePage({
      host: new URL(request.url).host,
      kind,
      toolsOrigin: env.ORIGINS.tools,
      rootDomain: env.ROOT_DOMAIN,
      signInUrl: signIn.toString(),
    });
  });

/** Everything a viewer is allowed to see of a share: its files, or the page explaining why not */
const visibleFiles = (request: Request, id: string, visibility: Visibility, viewer: Viewer) =>
  Effect.gen(function* () {
    const now = Date.now();
    const files = (yield* findFile(id)).filter((file) => file.visibility === visibility && !isExpired(file, now));
    const owner = files[0]?.owner;
    if (owner === undefined) return yield* interstitial(request, "files");
    if (visibility === "private" && viewer.login !== owner)
      return yield* interstitial(request, viewer.signedIn ? "files" : "private");
    return files;
  });

/** `/<id>/`: a bundle shows its folder; a single-file share is just the file, there is no folder to explore */
export const serveBundle = (request: Request, id: string, visibility: Visibility, viewer: Viewer) =>
  Effect.flatMap(visibleFiles(request, id, visibility, viewer), (files) => {
    if (files instanceof Response) return Effect.succeed(files);
    const [only] = files;
    if (!isBundleId(id) && only !== undefined) return serveFile(request, id, only.name, visibility, viewer);
    return Effect.succeed(listingPage({ host: new URL(request.url).host, id, files }));
  });

const encodeFilename = (name: string) =>
  `filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;

/**
 * Serves `/<id>/<name>` from R2; expired shares are deleted on the spot.
 * Private files are visible only to their owner (signed in through auth.blankparticle.com).
 */
export const serveFile = (request: Request, id: string, name: string, visibility: Visibility, viewer: Viewer) =>
  Effect.gen(function* () {
    const found = yield* getFile(id, name);
    if (found === null || found.record.visibility !== visibility) return yield* interstitial(request, "files");
    const { object, record } = found;
    if (isExpired(record)) {
      yield* deleteFile(id);
      return yield* interstitial(request, "files");
    }
    if (record.visibility === "private" && viewer.login !== record.owner)
      return yield* interstitial(request, viewer.signedIn ? "files" : "private");

    const remaining = record.expiresAt === null ? Infinity : Math.floor((record.expiresAt - Date.now()) / 1000);
    const headers = new Headers({
      "content-type": record.type,
      "content-length": String(object.size),
      "content-disposition": `${request.url.includes("?download") ? "attachment" : "inline"}; ${encodeFilename(name)}`,
      "cache-control":
        record.visibility === "private" ? "private, no-store" : `public, max-age=${Math.min(3600, remaining)}`,
      etag: object.httpEtag,
      "x-content-type-options": "nosniff",
    });
    if (record.expiresAt !== null) headers.set("expires", new Date(record.expiresAt).toUTCString());
    if (request.headers.get("if-none-match") === object.httpEtag) return new Response(null, { status: 304, headers });
    return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
  });

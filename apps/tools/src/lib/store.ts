import { and, desc, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

import type { Site, SiteFile, Visibility } from "../api/spec.ts";
import { query } from "../db/index.ts";
import { siteFiles, sites, type SiteRow } from "../db/schema.ts";
import { WorkerEnv } from "./env.ts";

/**
 * Sites and their file index live in D1; the bytes stay in KV:
 *   file:<slug>/<path>   raw bytes, metadata { type, size, etag } so serving is one KV read
 * Markdown is rendered on demand from its source (see `serve.ts`), nothing derived is stored.
 */

const MAX_PATH_LENGTH = 512;

export const filePrefix = (slug: string) => `file:${slug}/`;
const fileKey = (slug: string, path: string) => `${filePrefix(slug)}${path}`;

export type FileMeta = { type: string; size: number; etag: string };
export type StoredFile = { value: ArrayBuffer; meta: FileMeta };

const toSite = (env: { ORIGINS: { sites: string } }, row: SiteRow): Site => ({
  ...row,
  url: `https://${row.slug}.${env.ORIGINS.sites}/`,
});

const kv = Effect.map(WorkerEnv, (env) => env.KV);

/** Every key under `prefix`, following pagination */
export const listKeys = (prefix: string) =>
  Effect.flatMap(kv, (store) =>
    Effect.promise(async () => {
      const names: string[] = [];
      let cursor: string | undefined;
      while (true) {
        const page = await store.list({ prefix, cursor: cursor ?? null });
        names.push(...page.keys.map((key) => key.name));
        if (page.list_complete) return names;
        cursor = page.cursor;
      }
    }),
  );

/** Paths whose bytes exist in KV — the truth for what a site physically holds, index or not */
const storedPaths = (slug: string) =>
  Effect.map(listKeys(filePrefix(slug)), (names) => names.map((name) => name.slice(filePrefix(slug).length)));

export const sha256 = (data: Uint8Array | string) =>
  Effect.promise(async () => {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  });

/**
 * Normalises an uploaded file path to `a/b/c.html` form.
 * Returns null for anything that could escape the site (`..`), is empty, or is absurdly long.
 */
export const normalizePath = (input: string): string | null => {
  const segments = input
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".");
  if (segments.length === 0) return null;
  // eslint-disable-next-line no-control-regex
  if (segments.some((segment) => segment === ".." || /[\x00-\x1f]/.test(segment))) return null;
  const path = segments.join("/");
  return path.length > MAX_PATH_LENGTH ? null : path;
};

// ─── Sites ──────────────────────────────────────────────────────────

export const getSite = (slug: string) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const row = yield* query((d) => d.select().from(sites).where(eq(sites.slug, slug)).get());
    return row === undefined ? null : toSite(env, row);
  });

export const listSites = (owner: string) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const rows = yield* query((d) =>
      d.select().from(sites).where(eq(sites.owner, owner)).orderBy(desc(sites.updatedAt)),
    );
    return rows.map((row) => toSite(env, row));
  });

export const saveSite = (existing: Site | null, slug: string, owner: string, visibility?: Visibility) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const now = Date.now();
    const next = { owner, visibility: visibility ?? existing?.visibility ?? "public", updatedAt: now };
    const row = yield* query((d) =>
      d
        .insert(sites)
        .values({ slug, ...next, createdAt: now })
        .onConflictDoUpdate({ target: sites.slug, set: next })
        .returning()
        .get(),
    );
    return toSite(env, row);
  });

export const touchSite = (site: Site) =>
  Effect.gen(function* () {
    const env = yield* WorkerEnv;
    const row = yield* query((d) =>
      d.update(sites).set({ updatedAt: Date.now() }).where(eq(sites.slug, site.slug)).returning().get(),
    );
    return toSite(env, row ?? { ...site, updatedAt: Date.now() });
  });

const removeKeys = (keys: ReadonlyArray<string>) =>
  Effect.flatMap(kv, (store) =>
    Effect.forEach(keys, (key) => Effect.promise(() => store.delete(key)), { concurrency: 20, discard: true }),
  );
const removeBytes = (slug: string, paths: ReadonlyArray<string>) =>
  removeKeys(paths.map((path) => fileKey(slug, path)));

/** Drops the site row (its file index cascades) and every byte under its KV prefix, indexed or not */
export const deleteSite = (slug: string) =>
  Effect.gen(function* () {
    const paths = yield* storedPaths(slug);
    yield* removeBytes(slug, paths);
    yield* query((d) => d.delete(sites).where(eq(sites.slug, slug)));
  });

// ─── Files ──────────────────────────────────────────────────────────

const write = (key: string, bytes: Uint8Array, type: string) =>
  Effect.gen(function* () {
    const store = yield* kv;
    const etag = yield* sha256(bytes);
    const meta: FileMeta = { type, size: bytes.byteLength, etag };
    yield* Effect.promise(() => store.put(key, bytes, { metadata: meta }));
    return meta;
  });

const read = (key: string) =>
  Effect.gen(function* () {
    const store = yield* kv;
    const { value, metadata } = yield* Effect.promise(() => store.getWithMetadata<FileMeta>(key, "arrayBuffer"));
    if (value === null || metadata === null) return null;
    const file: StoredFile = { value, meta: metadata };
    return file;
  });

/** Stores the bytes in KV and indexes the file in D1 */
export const putFile = (slug: string, path: string, bytes: Uint8Array, type: string) =>
  Effect.gen(function* () {
    const meta = yield* write(fileKey(slug, path), bytes, type);
    const entry = { ...meta, updatedAt: Date.now() };
    yield* query((d) =>
      d
        .insert(siteFiles)
        .values({ siteSlug: slug, path, ...entry })
        .onConflictDoUpdate({ target: [siteFiles.siteSlug, siteFiles.path], set: entry }),
    );
    const file: SiteFile = { path, ...meta };
    return file;
  });

export const getFile = (slug: string, path: string) => read(fileKey(slug, path));

export const listFiles = (slug: string) =>
  query((d) =>
    d
      .select({ path: siteFiles.path, size: siteFiles.size, type: siteFiles.type, etag: siteFiles.etag })
      .from(siteFiles)
      .where(eq(siteFiles.siteSlug, slug))
      .orderBy(siteFiles.path),
  );

export const deleteFile = (slug: string, path: string) =>
  Effect.gen(function* () {
    yield* removeBytes(slug, [path]);
    yield* query((d) => d.delete(siteFiles).where(and(eq(siteFiles.siteSlug, slug), eq(siteFiles.path, path))));
  });

/** Deletes every file of the site whose path isn't in `keep` — checking KV as well as the index. Returns the removed paths. */
export const syncFiles = (slug: string, keep: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const wanted = new Set(keep);
    const [stored, indexed] = yield* Effect.all([storedPaths(slug), listFiles(slug)]);
    const stale = [...new Set([...stored, ...indexed.map((file) => file.path)])].filter((path) => !wanted.has(path));
    yield* Effect.forEach(stale, (path) => deleteFile(slug, path), { concurrency: 20, discard: true });
    return stale;
  });

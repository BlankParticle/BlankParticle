import * as Schema from "effect/Schema";

/** Shared constants and schemas for the worker and the `bp` CLI. Runtime-safe, no worker imports. */

/** A site slug is the subdomain label of `<slug>.sites.<root>`: a DNS label, lowercase, no leading dash */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const isValidSlug = (slug: string) => SLUG_PATTERN.test(slug) && !slug.endsWith("-");

/** Post-login redirect targets: same-site paths, or absolute URLs on our own domains (dev: localhost) */
export const isSafeNext = (next: string) =>
  (next.startsWith("/") && !next.startsWith("//")) ||
  /^https:\/\/([a-z0-9-]+\.)+blankparticle\.com\//.test(next) ||
  /^http:\/\/localhost(:\d+)?\//.test(next);

/** Site pages live in KV, whose values top out at 25 MiB; anything bigger belongs in a shared file (R2) */
export const MAX_SITE_FILE_BYTES = 25 * 1024 * 1024;
/** Shared files go to R2 (no practical size cap) but a Worker request body can't exceed 100 MiB */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MiB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MiB`;

/** Share ids are server-minted: 12 hex chars, prefixed `b-` when the share is a bundle of several files */
export const SHARE_ID_PATTERN = /^(b-)?[0-9a-f]{12}$/;
export const isBundleId = (id: string) => id.startsWith("b-");
/** Most files one manifest may carry */
export const MAX_BUNDLE_FILES = 500;

export const isMarkdown = (path: string) => /\.(md|markdown)$/i.test(path);

export const Slug = Schema.String.check(Schema.isPattern(SLUG_PATTERN));

export const Visibility = Schema.Literals(["public", "private"]);
export type Visibility = typeof Visibility.Type;

export const User = Schema.Struct({ login: Schema.String });
export type User = typeof User.Type;

/** What's persisted in D1 */
export const SiteRecord = Schema.Struct({
  slug: Schema.String,
  owner: Schema.String,
  visibility: Visibility,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
export type SiteRecord = typeof SiteRecord.Type;

/** What the API returns: the record plus where it's served */
export const Site = Schema.Struct({ ...SiteRecord.fields, url: Schema.String });
export type Site = typeof Site.Type;

export const SiteFile = Schema.Struct({
  path: Schema.String,
  size: Schema.Number,
  type: Schema.String,
  etag: Schema.String,
});
export type SiteFile = typeof SiteFile.Type;

// ─── Shared files (R2-backed) ───────────────────────────────────────

/** Default lifetime of an uploaded file */
export const DEFAULT_FILE_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Longest lifetime the server accepts (`null` ttl = never expires) */
export const MAX_FILE_TTL_SECONDS = 365 * 24 * 60 * 60;

/** What the client declares before uploading a byte */
export const ManifestFile = Schema.Struct({
  name: Schema.String,
  size: Schema.Number,
  type: Schema.String,
  /** sha256, lowercase hex */
  hash: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
});
export type ManifestFile = typeof ManifestFile.Type;

export const SharedFile = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  owner: Schema.String,
  size: Schema.Number,
  type: Schema.String,
  uploadedAt: Schema.Number,
  /** epoch millis, or null when the file never expires */
  expiresAt: Schema.NullOr(Schema.Number),
  visibility: Visibility,
  url: Schema.String,
});
export type SharedFile = typeof SharedFile.Type;

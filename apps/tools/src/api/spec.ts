import * as Context from "effect/Context";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "effect/http-api";
import * as Schema from "effect/Schema";

/**
 * The tools API, defined once for the worker (which implements it) and the `bp` CLI (which derives its client
 * from it), with the constants and schemas both sides share. Runtime-safe, no worker imports.
 */

/** A site slug is the subdomain label of `<slug>.sites.<root>`: a DNS label, lowercase, no leading dash */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
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
const ShareId = Schema.String.check(Schema.isPattern(SHARE_ID_PATTERN));
const ContentType = Schema.String.check(Schema.isPattern(/^[\w.+-]+\/[\w.+-]+(;[\w\s=.+-]*)?$/));

export const Visibility = Schema.Literals(["public", "private"]);
export type Visibility = typeof Visibility.Type;

export const User = Schema.Struct({ login: Schema.String });
export type User = typeof User.Type;

/** What's persisted in D1 */
const SiteRecord = Schema.Struct({
  slug: Schema.String,
  owner: Schema.String,
  visibility: Visibility,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

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

export const Manifest = Schema.Struct({
  /** Resume an earlier upload into the same share */
  id: Schema.optional(ShareId),
  files: Schema.Array(ManifestFile).check(Schema.isMinLength(1), Schema.isMaxLength(MAX_BUNDLE_FILES)),
  /** Seconds, or `never`; the default lifetime when omitted */
  ttl: Schema.optional(Schema.Union([Schema.Literal("never"), Schema.Number])),
  visibility: Schema.optional(Visibility),
});
export type Manifest = typeof Manifest.Type;

// ─── Errors ──────────────────────────────────────────────────────────

/*
 * Every failure the API answers with: `{ _tag, message }` under the annotated status. `status` repeats it for
 * TanStack Start, which answers a server function that threw with the error's `status`.
 */

export class BadRequest extends Schema.TaggedError<BadRequest>()(
  "BadRequest",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {
  readonly status = 400;
}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
  { httpApiStatus: 401 },
) {
  readonly status = 401;
}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  "Forbidden",
  { message: Schema.String },
  { httpApiStatus: 403 },
) {
  readonly status = 403;
}

export class NotFound extends Schema.TaggedError<NotFound>()(
  "NotFound",
  { message: Schema.String },
  { httpApiStatus: 404 },
) {
  readonly status = 404;
}

// ─── Middleware ──────────────────────────────────────────────────────

/** The signed-in, allow-listed user a request is made by */
export class CurrentUser extends Context.Service<CurrentUser, User>()("tools/CurrentUser") {}

/** Bearer auth with the id token `bp login` stores; any endpoint can also refuse with these */
export class Authorization extends HttpApiMiddleware.Service<Authorization, { provides: CurrentUser }>()(
  "tools/Authorization",
  { security: { bearer: HttpApiSecurity.bearer }, error: [Unauthorized, Forbidden, NotFound] },
) {}

/** A request that doesn't fit the endpoint's schemas (or otherwise makes no sense) is a `BadRequest` */
export class Validation extends HttpApiMiddleware.Service<Validation>()("tools/Validation", { error: BadRequest }) {}

// ─── Endpoints ───────────────────────────────────────────────────────

const site = { slug: Slug };
const share = { id: ShareId };

/** `client.me()` */
export class AccountApi extends HttpApiGroup.make("account", { topLevel: true }).add(
  HttpApiEndpoint.get("me", "/api/me", { success: User }),
) {}

/**
 * Sites are readable by their owner, and public ones by any signed-in user; writes are the owner's.
 * `putFile` takes the file's bytes as its raw body, streamed rather than decoded as a payload.
 */
export class SitesApi extends HttpApiGroup.make("sites").add(
  HttpApiEndpoint.get("list", "/api/sites", { success: Schema.Array(Site) }),
  HttpApiEndpoint.get("get", "/api/sites/:slug", {
    params: site,
    success: Schema.Struct({ site: Site, files: Schema.Array(SiteFile) }),
  }),
  HttpApiEndpoint.put("put", "/api/sites/:slug", {
    params: site,
    payload: Schema.Struct({ visibility: Schema.optional(Visibility) }),
    success: Site,
  }),
  HttpApiEndpoint.delete("delete", "/api/sites/:slug", { params: site }),
  HttpApiEndpoint.put("putFile", "/api/sites/:slug/files", {
    params: site,
    query: { path: Schema.String, type: Schema.optional(ContentType) },
    success: SiteFile,
  }),
  HttpApiEndpoint.get("getFile", "/api/sites/:slug/files", {
    params: site,
    query: { path: Schema.String },
    success: HttpApiSchema.StreamUint8Array(),
  }),
  HttpApiEndpoint.delete("deleteFile", "/api/sites/:slug/files", { params: site, query: { path: Schema.String } }),
  /** Removes every file not in `keep`, the last step of an upload */
  HttpApiEndpoint.post("sync", "/api/sites/:slug/sync", {
    params: site,
    payload: Schema.Struct({ keep: Schema.Array(Schema.String) }),
    success: Schema.Struct({ removed: Schema.Array(Schema.String) }),
  }),
) {}

/**
 * Shares, manifest first: `registerManifest` mints the share and says which files it still needs, then each one's
 * bytes go to `upload` as the raw body, streamed into R2.
 */
export class FilesApi extends HttpApiGroup.make("files").add(
  HttpApiEndpoint.get("list", "/api/files", { success: Schema.Array(SharedFile) }),
  HttpApiEndpoint.post("registerManifest", "/api/files/manifest", {
    payload: Manifest,
    success: Schema.Struct({
      id: Schema.String,
      url: Schema.String,
      files: Schema.Array(Schema.Struct({ name: Schema.String, uploaded: Schema.Boolean })),
    }),
  }),
  HttpApiEndpoint.put("upload", "/api/files/:id/upload", {
    params: share,
    query: { name: Schema.String },
    success: SharedFile,
  }),
  HttpApiEndpoint.get("get", "/api/files/:id", { params: share, success: Schema.Array(SharedFile) }),
  HttpApiEndpoint.get("download", "/api/files/:id/download", {
    params: share,
    query: { name: Schema.String },
    success: HttpApiSchema.StreamUint8Array(),
  }),
  HttpApiEndpoint.delete("delete", "/api/files/:id", { params: share }),
) {}

export class ToolsApi extends HttpApi.make("tools")
  .add(AccountApi, SitesApi, FilesApi)
  // the first middleware wraps the handler innermost: auth runs before anything is decoded
  .middleware(Validation)
  .middleware(Authorization) {}

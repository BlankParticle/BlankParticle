import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema for the tools D1 database: every record that used to be JSON in KV or R2 metadata.
 * Bytes stay where they were — site pages in KV (`file:` keys), shared files in R2. Timestamps are unix ms.
 */

const visibility = () => text("visibility", { enum: ["public", "private"] }).notNull();

/** A static site at sites.<root>/<slug>/ */
export const sites = sqliteTable(
  "sites",
  {
    slug: text("slug").primaryKey(),
    owner: text("owner").notNull(),
    visibility: visibility(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("sites_owner").on(t.owner)],
);

/** One row per uploaded page; the bytes live in KV under `file:<slug>/<path>` */
export const siteFiles = sqliteTable(
  "site_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    siteSlug: text("site_slug")
      .notNull()
      .references(() => sites.slug, { onDelete: "cascade" }),
    path: text("path").notNull(),
    size: integer("size").notNull(),
    type: text("type").notNull(),
    etag: text("etag").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("site_files_site_slug_path").on(t.siteSlug, t.path)],
);

/** What an id at files.<root>/<id>/ points to: one file, or a bundle (`b-` ids) of several shared together */
export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    visibility: visibility(),
    /** manifest time */
    createdAt: integer("created_at").notNull(),
    /** null = never expires */
    expiresAt: integer("expires_at"),
  },
  (t) => [index("shares_owner").on(t.owner), index("shares_expires_at").on(t.expiresAt)],
);

/**
 * One file of a share, declared by the client's manifest and stored in R2 at `<share_id>/<name>` once the bytes
 * arrive. `uploaded_at` is null until then; pending rows are invisible and swept with their share after a day.
 */
export const shareFiles = sqliteTable(
  "share_files",
  {
    shareId: text("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    type: text("type").notNull(),
    /** sha256 hex from the manifest; the upload must hash to this */
    hash: text("hash").notNull(),
    uploadedAt: integer("uploaded_at"),
  },
  (t) => [primaryKey({ columns: [t.shareId, t.name] })],
);

/** Email routing: first enabled rule matching the recipient wins, otherwise the zone default */
export const emailRules = sqliteTable(
  "email_rules",
  {
    id: text("id").primaryKey(),
    zone: text("zone").notNull(),
    address: text("address").notNull(),
    actionType: text("action_type", { enum: ["forward", "drop"] }).notNull(),
    actionTo: text("action_to"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    note: text("note"),
    /** Display/evaluation order within the ruleset */
    position: integer("position").notNull().default(0),
  },
  (t) => [index("email_rules_zone").on(t.zone)],
);

/** Per-zone action when no rule matches */
export const emailZoneDefaults = sqliteTable("email_zone_defaults", {
  zone: text("zone").primaryKey(),
  actionType: text("action_type", { enum: ["forward", "drop"] }).notNull(),
  actionTo: text("action_to"),
});

/** What happened to each inbound message; trimmed to the newest N */
export const emailActivity = sqliteTable(
  "email_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    receivedAt: integer("received_at").notNull(),
    from: text("from").notNull(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    outcome: text("outcome", { enum: ["forward", "drop"] }).notNull(),
    forwardedTo: text("forwarded_to"),
    ruleId: text("rule_id"),
  },
  (t) => [index("email_activity_received_at").on(t.receivedAt)],
);

/** PKCE state for a sign-in through auth.<root> that hasn't come back yet */
export const pendingLogins = sqliteTable(
  "pending_logins",
  {
    state: text("state").primaryKey(),
    codeVerifier: text("code_verifier").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    returnTo: text("return_to").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("pending_logins_expires_at").on(t.expiresAt)],
);

export type SiteRow = typeof sites.$inferSelect;
export type SiteFileRow = typeof siteFiles.$inferSelect;
export type ShareRow = typeof shares.$inferSelect;
export type ShareFileRow = typeof shareFiles.$inferSelect;
export type EmailRuleRow = typeof emailRules.$inferSelect;
export type EmailZoneDefaultRow = typeof emailZoneDefaults.$inferSelect;
export type EmailActivityRow = typeof emailActivity.$inferSelect;

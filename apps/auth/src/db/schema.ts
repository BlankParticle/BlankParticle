import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Drizzle schema for the auth broker's D1 database. Timestamps are unix milliseconds. */

/** People, keyed by their GitHub id; refreshed on every GitHub sign-in */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  login: text("login").notNull(),
  name: text("name"),
  picture: text("picture").notNull(),
  email: text("email"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * A sign-in in flight. One row moves through the stages, getting a fresh unguessable id each time:
 * `pending` (id = state given to GitHub) → `consent` (id = consent token) → `code` (id = authorization code).
 */
export const authorizationRequests = sqliteTable(
  "authorization_requests",
  {
    id: text("id").primaryKey(),
    stage: text("stage", { enum: ["pending", "consent", "code"] }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    clientId: text("client_id").notNull(),
    clientName: text("client_name"),
    clientLogo: text("client_logo"),
    /** `aud` of the resulting token: the client itself, or the `resource` it asked for */
    audience: text("audience").notNull(),
    clientState: text("client_state").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    pii: integer("pii", { mode: "boolean" }).notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("authorization_requests_expires_at").on(t.expiresAt)],
);

/** An app the person authorized; loopback clients collapse to one row regardless of port */
export const apps = sqliteTable(
  "apps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientKey: text("client_key").notNull(),
    clientId: text("client_id").notNull(),
    name: text("name"),
    logo: text("logo"),
    audience: text("audience").notNull(),
    pii: integer("pii", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("apps_user_client_audience").on(t.userId, t.clientKey, t.audience)],
);

/** Every id_token issued, for `/session/check` and the dashboard */
export const tokens = sqliteTable(
  "tokens",
  {
    jti: text("jti").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    clientName: text("client_name"),
    clientLogo: text("client_logo"),
    audience: text("audience").notNull(),
    pii: integer("pii", { mode: "boolean" }).notNull(),
    issuedAt: integer("issued_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (t) => [index("tokens_user_id").on(t.userId)],
);

/** Browsers holding the broker's `auth_session` cookie */
export const browserSessions = sqliteTable(
  "browser_sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("browser_sessions_user_id").on(t.userId)],
);

/** RFC 8628 device authorization: a CLI or headless device waits while the person approves a short code here */
export const deviceCodes = sqliteTable(
  "device_codes",
  {
    deviceCode: text("device_code").primaryKey(),
    userCode: text("user_code").notNull(),
    clientId: text("client_id").notNull(),
    clientName: text("client_name"),
    clientLogo: text("client_logo"),
    audience: text("audience").notNull(),
    pii: integer("pii", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["pending", "approved", "denied"] })
      .notNull()
      .default("pending"),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Minimum seconds between polls; `slow_down` bumps it */
    interval: integer("interval").notNull(),
    lastPolledAt: integer("last_polled_at"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [uniqueIndex("device_codes_user_code").on(t.userCode)],
);

export type User = typeof users.$inferSelect;
export type AuthorizationRequest = typeof authorizationRequests.$inferSelect;
export type App = typeof apps.$inferSelect;
export type Token = typeof tokens.$inferSelect;
export type BrowserSession = typeof browserSessions.$inferSelect;

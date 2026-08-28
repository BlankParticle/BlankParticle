import { desc, notInArray } from "drizzle-orm";
import * as Schema from "effect/Schema";

import type { Database } from "../db/index.ts";
import {
  emailActivity,
  emailZoneDefaults,
  emailRules,
  type EmailActivityRow,
  type EmailRuleRow,
} from "../db/schema.ts";

export const ACTIVITY_LOG_LIMIT = 200;

export const RuleAction = Schema.Union([
  Schema.Struct({ type: Schema.Literal("forward"), to: Schema.String }),
  Schema.Struct({ type: Schema.Literal("drop") }),
]);
export type RuleAction = typeof RuleAction.Type;

export const EmailRule = Schema.Struct({
  id: Schema.String,
  zone: Schema.String,
  address: Schema.String,
  action: RuleAction,
  enabled: Schema.Boolean,
  note: Schema.optionalKey(Schema.String),
});
export type EmailRule = typeof EmailRule.Type;

export const RuleSet = Schema.Struct({
  rules: Schema.Array(EmailRule),
  /** Per-zone action when no rule matches */
  defaults: Schema.Record(Schema.String, RuleAction),
});
export type RuleSet = typeof RuleSet.Type;

export type ActivityEntry = {
  ts: number;
  from: string;
  to: string;
  subject: string;
  outcome: "forward" | "drop";
  forwardedTo?: string;
  ruleId?: string;
};

export const EMPTY_RULE_SET: RuleSet = { rules: [], defaults: {} };

export type Verdict = { action: RuleAction; rule?: EmailRule };

export function evaluate(ruleSet: RuleSet, recipient: string): Verdict {
  const to = recipient.toLowerCase();
  const rule = ruleSet.rules.find((rule) => rule.enabled && rule.address.toLowerCase() === to);
  if (rule) return { action: rule.action, rule };
  const domain = to.split("@")[1] ?? "";
  return { action: ruleSet.defaults[domain] ?? { type: "drop" } };
}

// ─── D1 persistence (plain async so both the Effect modules and the email handler can use it) ───

const toAction = (row: { actionType: "forward" | "drop"; actionTo: string | null }): RuleAction =>
  row.actionType === "forward" ? { type: "forward", to: row.actionTo ?? "" } : { type: "drop" };
const fromAction = (action: RuleAction) =>
  action.type === "forward"
    ? { actionType: "forward" as const, actionTo: action.to }
    : { actionType: "drop" as const, actionTo: null };

const toRule = (row: EmailRuleRow): EmailRule => ({
  id: row.id,
  zone: row.zone,
  address: row.address,
  action: toAction(row),
  enabled: row.enabled,
  ...(row.note !== null && { note: row.note }),
});

export async function readRuleSet(db: Database): Promise<RuleSet> {
  const [rules, defaults] = await Promise.all([
    db.select().from(emailRules).orderBy(emailRules.position),
    db.select().from(emailZoneDefaults),
  ]);
  return { rules: rules.map(toRule), defaults: Object.fromEntries(defaults.map((row) => [row.zone, toAction(row)])) };
}

/** Replaces the whole ruleset; the UI edits and saves it as one document */
export async function writeRuleSet(db: Database, ruleSet: RuleSet) {
  await db.delete(emailRules);
  await db.delete(emailZoneDefaults);
  if (ruleSet.rules.length > 0)
    await db.insert(emailRules).values(
      ruleSet.rules.map((rule, position) => ({
        id: rule.id,
        zone: rule.zone,
        address: rule.address,
        ...fromAction(rule.action),
        enabled: rule.enabled,
        note: rule.note ?? null,
        position,
      })),
    );
  const defaults = Object.entries(ruleSet.defaults);
  if (defaults.length > 0)
    await db.insert(emailZoneDefaults).values(defaults.map(([zone, action]) => ({ zone, ...fromAction(action) })));
}

const toEntry = (row: EmailActivityRow): ActivityEntry => ({
  ts: row.receivedAt,
  from: row.from,
  to: row.to,
  subject: row.subject,
  outcome: row.outcome,
  ...(row.forwardedTo !== null && { forwardedTo: row.forwardedTo }),
  ...(row.ruleId !== null && { ruleId: row.ruleId }),
});

export async function readActivity(db: Database): Promise<ActivityEntry[]> {
  const rows = await db.select().from(emailActivity).orderBy(desc(emailActivity.receivedAt)).limit(ACTIVITY_LOG_LIMIT);
  return rows.map(toEntry);
}

/** Appends an entry and keeps only the newest `ACTIVITY_LOG_LIMIT` */
export async function recordActivity(db: Database, entry: ActivityEntry) {
  await db.insert(emailActivity).values({
    receivedAt: entry.ts,
    from: entry.from,
    to: entry.to,
    subject: entry.subject,
    outcome: entry.outcome,
    forwardedTo: entry.forwardedTo ?? null,
    ruleId: entry.ruleId ?? null,
  });
  const keep = db
    .select({ id: emailActivity.id })
    .from(emailActivity)
    .orderBy(desc(emailActivity.receivedAt))
    .limit(ACTIVITY_LOG_LIMIT);
  await db.delete(emailActivity).where(notInArray(emailActivity.id, keep));
}

export const clearActivity = (db: Database) => db.delete(emailActivity).then(() => undefined);

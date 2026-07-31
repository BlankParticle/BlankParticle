import * as Schema from "effect/Schema";

export const RULESET_KEY = "ruleset";
export const ACTIVITY_LOG_KEY = "activity-log";
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

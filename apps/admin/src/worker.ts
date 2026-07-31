import tanstackHandler from "@tanstack/react-start/server-entry";

import type { AdminAppEnv } from "../alchemy.config.ts";
import {
  ACTIVITY_LOG_KEY,
  ACTIVITY_LOG_LIMIT,
  EMPTY_RULE_SET,
  evaluate,
  RULESET_KEY,
  type ActivityEntry,
  type RuleSet,
} from "./lib/rules.ts";

async function recordActivity(env: AdminAppEnv, entry: ActivityEntry) {
  const log = (await env.EMAIL_RULES.get<ActivityEntry[]>(ACTIVITY_LOG_KEY, "json")) ?? [];
  log.unshift(entry);
  await env.EMAIL_RULES.put(ACTIVITY_LOG_KEY, JSON.stringify(log.slice(0, ACTIVITY_LOG_LIMIT)));
}

export default {
  async fetch(request, env, ctx) {
    return tanstackHandler.fetch(request, {
      context: { cf: { env, ctx } },
    });
  },

  async email(message, env, ctx) {
    const ruleSet = (await env.EMAIL_RULES.get<RuleSet>(RULESET_KEY, "json")) ?? EMPTY_RULE_SET;
    const { action, rule } = evaluate(ruleSet, message.to);

    if (action.type === "forward") await message.forward(action.to);
    // drop: accept the message and do nothing with it

    ctx.waitUntil(
      recordActivity(env, {
        ts: Date.now(),
        from: message.from,
        to: message.to,
        subject: message.headers.get("subject") ?? "",
        outcome: action.type,
        ...(action.type === "forward" && { forwardedTo: action.to }),
        ...(rule && { ruleId: rule.id }),
      }),
    );
  },
} satisfies ExportedHandler<AdminAppEnv>;

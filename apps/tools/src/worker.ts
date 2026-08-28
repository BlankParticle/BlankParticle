import { Context } from "effect";

import type { ToolsAppEnv } from "../alchemy.config.ts";
import { toolsHandler } from "./api/app.ts";
import { WorkerExecutionContext } from "./api/context.ts";
import { database } from "./db/index.ts";
import { WorkerEnv, workerRuntime } from "./lib/env.ts";
import { purgeExpired } from "./lib/files.ts";
import { evaluate, readRuleSet, recordActivity } from "./lib/rules.ts";

/**
 * One worker, four hosts:
 *   tools.<root>          dashboard, API, sign-in
 *   <slug>.sites.<root>   static sites, each on its own origin (sites.<root> itself → tools)
 *   files.<root>          file shares at /<id>/<name>
 *   email.<root>          shortcut to the email tool
 * In dev: tools on localhost, sites on <slug>.localhost, files at /f/<id>/<name>.
 */
export default {
  fetch(request, env, ctx) {
    return toolsHandler.handler(request, Context.make(WorkerEnv, env).pipe(Context.add(WorkerExecutionContext, ctx)));
  },

  async scheduled(_event, env) {
    const purged = await workerRuntime(env).runPromise(purgeExpired);
    console.log(`purged ${purged} expired file(s)`);
  },

  /** Every zone's catch-all points here; first matching rule wins, otherwise the zone default */
  async email(message, env, ctx) {
    const db = database(env.DB);
    const { action, rule } = evaluate(await readRuleSet(db), message.to);

    if (action.type === "forward") await message.forward(action.to);
    // drop: accept the message and do nothing with it

    ctx.waitUntil(
      recordActivity(db, {
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
} satisfies ExportedHandler<ToolsAppEnv>;

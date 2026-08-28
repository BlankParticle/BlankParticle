import * as Drizzle from "alchemy/Drizzle/D1";
import { Context, Effect } from "effect";

import type { AuthAppEnv } from "../../alchemy.config.ts";

export class WorkerEnv extends Context.Service<WorkerEnv, AuthAppEnv>()("auth/WorkerEnv") {}
export class WorkerExecutionContext extends Context.Service<WorkerExecutionContext, ExecutionContext>()(
  "auth/WorkerExecutionContext",
) {}

export const AuthDatabase = Effect.flatMap(WorkerEnv, (env) => Drizzle.D1(Effect.succeed(env.DB)));
export type AuthDatabase = Effect.Success<typeof AuthDatabase>;

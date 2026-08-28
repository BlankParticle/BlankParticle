import { Context } from "effect";

export class WorkerExecutionContext extends Context.Service<WorkerExecutionContext, ExecutionContext>()(
  "tools/WorkerExecutionContext",
) {}

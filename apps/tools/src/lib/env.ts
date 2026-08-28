import { fromApiToken, type Credentials } from "@distilled.cloud/cloudflare/Credentials";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import type * as HttpClient from "effect/unstable/http/HttpClient";

import type { ToolsAppEnv } from "../../alchemy.config.ts";

/** The worker's bindings (KV, R2, tokens, origins) as an Effect service */
export class WorkerEnv extends Context.Service<WorkerEnv, ToolsAppEnv>()("tools/WorkerEnv") {}

export type WorkerServices = WorkerEnv | HttpClient.HttpClient | Credentials;
export type WorkerRuntime = ManagedRuntime.ManagedRuntime<WorkerServices, never>;

export const workerLayer = (env: ToolsAppEnv) =>
  Layer.mergeAll(Layer.succeed(WorkerEnv, env), FetchHttpClient.layer, fromApiToken({ apiToken: env.CF_API_TOKEN }));

let cached: { env: ToolsAppEnv; runtime: WorkerRuntime } | undefined;

/** One runtime per isolate; the bindings object is stable within an isolate. */
export function workerRuntime(env: ToolsAppEnv): WorkerRuntime {
  if (cached?.env !== env) cached = { env, runtime: ManagedRuntime.make(workerLayer(env)) };
  return cached.runtime;
}

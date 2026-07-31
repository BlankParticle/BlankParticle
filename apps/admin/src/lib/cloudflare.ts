import { fromApiToken, type Credentials } from "@distilled.cloud/cloudflare/Credentials";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import type * as HttpClient from "effect/unstable/http/HttpClient";

import type { AdminAppEnv } from "../../alchemy.config.ts";

/** The worker's bindings (KV, token, account id) as an Effect service */
export class WorkerEnv extends Context.Service<WorkerEnv, AdminAppEnv>()("WorkerEnv") {}

export type WorkerServices = WorkerEnv | Credentials | HttpClient.HttpClient;
export type WorkerRuntime = ManagedRuntime.ManagedRuntime<WorkerServices, never>;

let cached: { env: AdminAppEnv; runtime: WorkerRuntime } | undefined;

/**
 * One Effect runtime per isolate, shared across requests so layers are built
 * once and memoized. The bindings object is stable within an isolate; a new one
 * (fresh isolate, dev reload) rebuilds the runtime.
 */
export function workerRuntime(env: AdminAppEnv): WorkerRuntime {
  if (cached?.env !== env) {
    cached = {
      env,
      runtime: ManagedRuntime.make(
        Layer.mergeAll(
          Layer.succeed(WorkerEnv, env),
          fromApiToken({ apiToken: env.CF_API_TOKEN }),
          FetchHttpClient.layer,
        ),
      ),
    };
  }
  return cached.runtime;
}

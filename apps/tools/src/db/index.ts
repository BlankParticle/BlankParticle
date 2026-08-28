import { drizzle } from "drizzle-orm/d1";
import * as Effect from "effect/Effect";

import { WorkerEnv } from "../lib/env.ts";

/** Drizzle over the Worker's D1 binding; cheap to construct, so one per use is fine */
export const database = (d1: D1Database) => drizzle(d1);
export type Database = ReturnType<typeof database>;

/** The database as an Effect, for the Effect-based modules (`store`, `files`, `email-api`) */
export const db = Effect.map(WorkerEnv, (env) => database(env.DB));

/** Runs a drizzle query (a thenable) inside Effect */
export const query = <A>(run: (db: Database) => PromiseLike<A>) =>
  Effect.flatMap(db, (d) => Effect.promise(() => run(d)));

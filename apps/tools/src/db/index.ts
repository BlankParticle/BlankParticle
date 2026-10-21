import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import * as Arr from "effect/Array";
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

/** D1 binds at most 100 parameters per statement, so multi-row inserts go in chunks of `100 / columns` rows */
export const rowChunks = <A>(rows: ReadonlyArray<A>, columns: number) => Arr.chunksOf(rows, Math.floor(100 / columns));

/** Runs the statements as one D1 batch: a single round trip, applied atomically */
export const runBatch = async (d: Database, statements: ReadonlyArray<BatchItem<"sqlite">>) => {
  if (Arr.isReadonlyArrayNonEmpty(statements)) await d.batch(statements);
};

import { createServerFn, getGlobalStartContext } from "@tanstack/react-start";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { Slug, Unauthorized, Visibility, type User } from "../api/spec.ts";
import { workerRuntime, type WorkerServices } from "./env.ts";
import * as files from "./files.ts";
import { deleteSite, listSites, ownedSite, saveSite } from "./store.ts";

const context = () => {
  const ctx = getGlobalStartContext();
  if (!ctx) throw new Error("Cloudflare request context unavailable");
  return ctx;
};

/**
 * Runs an Effect for the signed-in, allow-listed user; anonymous calls fail before touching anything.
 * An API error (`spec.ts`) reaches the client with its message, and its status becomes the response's.
 */
export const run = <A, E>(effect: (user: User) => Effect.Effect<A, E, WorkerServices>): Promise<A> => {
  const ctx = context();
  if (!ctx.user) throw new Unauthorized({ message: "not signed in" });
  return workerRuntime(ctx.cf.env).runPromise(effect(ctx.user));
};

export type Me = { user: User | null; denied: string | null };

/** Who is signed in: the worker resolved it before handing off to TanStack, so this never touches D1 */
export const getMe = createServerFn().handler((): Me => {
  const ctx = context();
  return { user: ctx.user, denied: ctx.user ? null : ctx.denied };
});

export const getSites = createServerFn().handler(() => run((user) => listSites(user.login)));

export const getFiles = createServerFn().handler(() => run((user) => files.listFiles(user.login)));

export const removeFile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })))
  .handler(({ data }) =>
    run((user) => files.ownedShare(data.id, user.login).pipe(Effect.andThen(files.deleteFile(data.id)), Effect.asVoid)),
  );

export const setSiteVisibility = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ slug: Slug, visibility: Visibility })))
  .handler(({ data }) =>
    run((user) =>
      Effect.flatMap(ownedSite(data.slug, user.login), (site) =>
        saveSite(site, data.slug, user.login, data.visibility),
      ),
    ),
  );

export const removeSite = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ slug: Slug })))
  .handler(({ data }) => run((user) => ownedSite(data.slug, user.login).pipe(Effect.andThen(deleteSite(data.slug)))));

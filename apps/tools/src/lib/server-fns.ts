import { createServerFn, getGlobalStartContext } from "@tanstack/react-start";
import * as Schema from "effect/Schema";

import { Slug, Visibility, type SharedFile, type Site, type User } from "../api/spec.ts";
import { workerRuntime } from "./env.ts";
import * as files from "./files.ts";
import { deleteSite, getSite, listSites, saveSite } from "./store.ts";

const context = () => {
  const ctx = getGlobalStartContext();
  if (!ctx) throw new Error("Cloudflare request context unavailable");
  return ctx;
};

export const requireUser = () => {
  const ctx = context();
  if (!ctx.user) throw new Error("not signed in");
  return { user: ctx.user, runtime: workerRuntime(ctx.cf.env) };
};

export type Dashboard = { user: User | null; denied: string | null; sites: Site[]; files: SharedFile[] };

export const getDashboard = createServerFn().handler(async (): Promise<Dashboard> => {
  const ctx = context();
  if (!ctx.user) return { user: null, denied: ctx.denied, sites: [], files: [] };
  const [sites, shares] = await Promise.all([
    workerRuntime(ctx.cf.env).runPromise(listSites(ctx.user.login)),
    workerRuntime(ctx.cf.env).runPromise(files.listFiles(ctx.user.login)),
  ]);
  return { user: ctx.user, denied: null, sites, files: shares };
});

export const removeFile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })))
  .handler(async ({ data }) => {
    const { user, runtime } = requireUser();
    const owner = await runtime.runPromise(files.ownerOf(data.id));
    if (owner !== user.login) throw new Error("not your file");
    await runtime.runPromise(files.deleteFile(data.id));
  });

export const setSiteVisibility = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ slug: Slug, visibility: Visibility })))
  .handler(async ({ data }): Promise<Site> => {
    const { user, runtime } = requireUser();
    const existing = await runtime.runPromise(getSite(data.slug));
    if (existing?.owner !== user.login) throw new Error("not your site");
    return runtime.runPromise(saveSite(existing, data.slug, user.login, data.visibility));
  });

export const removeSite = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ slug: Slug })))
  .handler(async ({ data }) => {
    const { user, runtime } = requireUser();
    const existing = await runtime.runPromise(getSite(data.slug));
    if (existing?.owner !== user.login) throw new Error("not your site");
    await runtime.runPromise(deleteSite(data.slug));
  });

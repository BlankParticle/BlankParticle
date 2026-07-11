import tanstackHandler from "@tanstack/react-start/server-entry";
import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";

import { socials } from "./lib/data.ts";

export type CloudflareEnv = {
  TARGET_DOMAIN: string;
};

const app = new Hono<{ Bindings: CloudflareEnv }>();

app.use(async (c, next) => {
  const url = new URL(c.req.url);
  if (url.hostname !== c.env.TARGET_DOMAIN) {
    url.hostname = c.env.TARGET_DOMAIN;
    return c.redirect(url, 301);
  }
  return next();
});

app.use(trimTrailingSlash());

app.use("*", async (c, next) => {
  const path = c.req.path;
  if (path.startsWith("/gh/") || path.startsWith("/github/"))
    return c.redirect(`https://github.com/BlankParticle/${path.slice(path.lastIndexOf("/") + 1)}`, 301);

  const match = socials.find((social) => social.shortLink.includes(path));
  if (match) return c.redirect(match.url, 301);
  return next();
});

app.use("*", async (c) =>
  tanstackHandler.fetch(c.req.raw, {
    context: { cf: { env: c.env, ctx: c.executionCtx as ExecutionContext<unknown> } },
  }),
);

export default app;

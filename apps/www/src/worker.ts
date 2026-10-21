import tanstackHandler from "@tanstack/react-start/server-entry";

import type { WwwAppEnv } from "../alchemy.config.ts";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Move the Blog and Extra Domains onto the Target Domain
    if (!import.meta.env.DEV) {
      if (env.BLOG_DOMAINS.includes(url.hostname)) {
        url.hostname = env.TARGET_DOMAIN;
        url.pathname = `/blog${url.pathname}`;
      } else if (env.EXTRA_DOMAINS.includes(url.hostname)) {
        url.hostname = env.TARGET_DOMAIN;
      }
    }

    // Trim Trailing Slash
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    // one redirect for both, so the blog's root lands on /blog directly
    if (url.href !== request.url) return Response.redirect(url, 301);

    return tanstackHandler.fetch(request, {
      context: { cf: { env, ctx } },
    });
  },
} satisfies ExportedHandler<WwwAppEnv>;

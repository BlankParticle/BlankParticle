import tanstackHandler from "@tanstack/react-start/server-entry";

import type { MainWebsiteEnv } from "../spec.ts";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Trim Trailing Slash
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
      return Response.redirect(url, 301);
    }

    // Redirect to Target Domain if either on Blog or Extra Domains
    if (!import.meta.env.DEV) {
      if (env.BLOG_DOMAINS.includes(url.hostname)) {
        url.hostname = env.TARGET_DOMAIN;
        url.pathname = `/blog${url.pathname}`;
        return Response.redirect(url, 301);
      }

      if (env.EXTRA_DOMAINS.includes(url.hostname)) {
        url.hostname = env.TARGET_DOMAIN;
        return Response.redirect(url, 301);
      }
    }

    return tanstackHandler.fetch(request, {
      context: { cf: { env, ctx } },
    });
  },
} satisfies ExportedHandler<MainWebsiteEnv>;

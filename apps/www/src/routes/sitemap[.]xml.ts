import { createFileRoute } from "@tanstack/react-router";

import { postMeta } from "#/lib/blog-meta.ts";
import { SITE_URL } from "#/lib/data.ts";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const latestPostDate = postMeta[0]?.date;

        const urls = [
          { loc: SITE_URL },
          { loc: `${SITE_URL}/links` },
          { loc: `${SITE_URL}/email` },
          { loc: `${SITE_URL}/discord` },
          { loc: `${SITE_URL}/blog`, lastmod: latestPostDate },
          ...postMeta.map((post) => ({ loc: `${SITE_URL}/blog/${post.slug}`, lastmod: post.date })),
        ];

        const body = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls.map(
            ({ loc, lastmod }) => `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
          ),
          `</urlset>`,
        ].join("\n");

        return new Response(body, { headers: { "content-type": "application/xml; charset=UTF-8" } });
      },
    },
  },
});

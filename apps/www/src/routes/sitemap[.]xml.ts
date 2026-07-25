import { createFileRoute } from "@tanstack/react-router";

import { blogSource } from "@/lib/blog-content.ts";
import { SITE_URL } from "@/lib/data.ts";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const posts = blogSource.getPages().sort((a, b) => b.data.date.localeCompare(a.data.date));
        const latestPostDate = posts[0]?.data.date;

        const urls = [
          { loc: SITE_URL },
          { loc: `${SITE_URL}/blog`, lastmod: latestPostDate },
          ...posts.map((post) => ({ loc: `${SITE_URL}/blog/${post.slugs[0]}`, lastmod: post.data.date })),
        ];

        const body = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls.map(
            ({ loc, lastmod }) =>
              `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
          ),
          `</urlset>`,
        ].join("\n");

        return new Response(body, { headers: { "content-type": "application/xml; charset=UTF-8" } });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

import { blogSource } from "@/lib/blog-content.ts";
import { SITE_URL } from "@/lib/data.ts";

const escapeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: () => {
        const posts = blogSource.getPages().sort((a, b) => b.data.date.localeCompare(a.data.date));

        const items = posts.map((post) => {
          const url = `${SITE_URL}/blog/${post.slugs[0]}`;
          return [
            `<item>`,
            `<title>${escapeXml(post.data.title)}</title>`,
            `<link>${url}</link>`,
            `<guid isPermaLink="true">${url}</guid>`,
            `<description>${escapeXml(post.data.description)}</description>`,
            `<pubDate>${new Date(`${post.data.date}T00:00:00Z`).toUTCString()}</pubDate>`,
            ...post.data.tags.map((tag) => `<category>${escapeXml(tag)}</category>`),
            `</item>`,
          ].join("");
        });

        const body = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
          `<channel>`,
          `<title>blankparticle's blog</title>`,
          `<link>${SITE_URL}/blog</link>`,
          `<description>Things I wrote down so I wouldn't have to figure them out twice.</description>`,
          `<language>en</language>`,
          `<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>`,
          ...items,
          `</channel>`,
          `</rss>`,
        ].join("\n");

        return new Response(body, { headers: { "content-type": "application/rss+xml; charset=UTF-8" } });
      },
    },
  },
});

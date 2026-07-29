import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NotFound } from "@/components/not-found.tsx";
import { SITE_URL } from "@/lib/data.ts";

import appCss from "@/styles/app.css?url";

const title = "blankparticle";
const description = "Personal site of Rahul Mishra, aka BlankParticle, a software developer passionate about tech";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:site_name", content: "blankparticle" },
      { property: "og:url", content: SITE_URL },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${SITE_URL}/og-image.webp` },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "twitter:domain", content: "blankparticle.com" },
      { property: "twitter:url", content: SITE_URL },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.webp` },
    ],
    links: [
      { rel: "icon", href: "/me.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "alternate", type: "application/rss+xml", title: "blankparticle's blog", href: "/rss.xml" },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

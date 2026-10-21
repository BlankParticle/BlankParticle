import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NotFound } from "#/components/not-found.tsx";
import { SiteLayout } from "#/components/site-layout.tsx";
import { SITE_DESCRIPTION, SITE_NAME } from "#/lib/site.ts";

import appCss from "../app.css?url";

/** Defaults for every page; each route's `seo()` overrides the title and description and adds the Open Graph tags */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_NAME },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "alternate", type: "application/rss+xml", title: "blankparticle's blog", href: "/rss.xml" },
    ],
  }),
  headers: () => ({
    // pages only change on deploy; kept short since a cached page points at hashed assets the next deploy removes
    "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
  component: RootLayout,
});

/** The masthead, backdrop and footer are mounted once here, so navigating only swaps the page inside */
function RootLayout() {
  return (
    <SiteLayout>
      <Outlet />
    </SiteLayout>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      {/* isolate, so the page backdrop's negative z-index stays above the body's paper colour */}
      <body className="isolate">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

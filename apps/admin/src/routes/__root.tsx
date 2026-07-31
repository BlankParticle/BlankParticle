import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Link, Scripts, useRouterState } from "@tanstack/react-router";
import { MailboxIcon, RadarIcon } from "lucide-react";
import type { ReactNode } from "react";

import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "admin · blankparticle" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

const navLinks = [
  { to: "/", label: "Zones", icon: RadarIcon },
  { to: "/email", label: "Email Rules", icon: MailboxIcon },
] as const;

function NavigationIndicator() {
  const isNavigating = useRouterState({ select: (state) => state.status === "pending" });
  if (!isNavigating) return null;
  return (
    <div className="absolute inset-x-0 bottom-[-2px] h-0.5 overflow-hidden">
      <div className="bg-orange animate-indeterminate h-full w-1/3" />
    </div>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="border-ink bg-paper/90 sticky top-0 z-40 border-b-2 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
            <Link to="/" className="font-mono text-sm font-bold tracking-tight">
              <span className="text-violet">▞▞</span> blankparticle<span className="text-ink-muted">/admin</span>
            </Link>
            <nav className="flex items-center gap-2">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="border-ink text-ink hover:bg-lime rounded-full border-2 px-3.5 py-1 text-sm font-bold transition-all hover:-translate-y-0.5"
                  activeProps={{ className: "bg-violet text-paper hover:bg-violet" }}
                  activeOptions={{ exact: to === "/" }}
                >
                  <Icon className="mr-1.5 inline size-3.5 align-[-2px]" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <NavigationIndicator />
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <Scripts />
      </body>
    </html>
  );
}

import {
  AppShell,
  Brand,
  navLinkActiveClass,
  navLinkClass,
  navLinkInactiveClass,
} from "@blankparticle/ui/components/app-shell.tsx";
import { AtomIcon, EnvelopeSimpleIcon, FileIcon, GlobeIcon, TerminalWindowIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { dashboardQuery } from "../lib/queries.ts";

import appCss from "../app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "tools · blankparticle" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  shellComponent: RootDocument,
  component: RootLayout,
});

const navLinks = [
  { to: "/", label: "Sites", icon: GlobeIcon },
  { to: "/files", label: "Files", icon: FileIcon },
  { to: "/email", label: "Email", icon: EnvelopeSimpleIcon },
  { to: "/cli", label: "CLI", icon: TerminalWindowIcon },
] as const;

function NavigationIndicator() {
  const isNavigating = useRouterState({ select: (state) => state.status === "pending" });
  if (!isNavigating) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      <div className="bg-primary animate-indeterminate h-full w-1/3" />
    </div>
  );
}

function UserMenu() {
  const { data } = useSuspenseQuery(dashboardQuery);
  if (!data.user) return null;
  return (
    <form method="post" action="/auth/logout" className="flex items-center gap-3">
      <span className="text-muted-foreground hidden text-sm sm:inline">
        <span className="text-foreground font-medium">{data.user.login}</span>
      </span>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}

function RootLayout() {
  const { data } = useSuspenseQuery(dashboardQuery);
  return (
    <AppShell
      brand={
        <Link to="/">
          <Brand icon={<AtomIcon weight="bold" />} product="tools" />
        </Link>
      }
      nav={
        data.user &&
        navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={navLinkClass}
            inactiveProps={{ className: navLinkInactiveClass }}
            activeProps={{ className: navLinkActiveClass }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))
      }
      actions={<UserMenu />}
    >
      <NavigationIndicator />
      <Outlet />
    </AppShell>
  );
}

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

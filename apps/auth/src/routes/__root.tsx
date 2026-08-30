import {
  AppShell,
  Brand,
  navLinkActiveClass,
  navLinkClass,
  navLinkInactiveClass,
} from "@blankparticle/ui/components/app-shell.tsx";
import { AppWindowIcon, DevicesIcon, FingerprintIcon, KeyIcon, UserIcon } from "@blankparticle/ui/icons";
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useMatch } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "auth · blankparticle" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

const navLinks = [
  { to: "/", label: "Profile", icon: UserIcon },
  { to: "/apps", label: "Apps", icon: AppWindowIcon },
  { to: "/sessions", label: "Sessions", icon: KeyIcon },
  { to: "/devices", label: "Devices", icon: DevicesIcon },
] as const;

function RootLayout() {
  // Only the dashboard layout knows whether someone is signed in; consent/error pages have no nav
  const dashboard = useMatch({ from: "/_dashboard", shouldThrow: false })?.loaderData ?? null;
  return (
    <AppShell
      brand={
        <Link to="/">
          <Brand icon={<FingerprintIcon weight="bold" />} product="auth" />
        </Link>
      }
      nav={
        dashboard &&
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
      actions={
        dashboard && (
          <span className="inline-flex items-center gap-2 text-sm">
            <img src={dashboard.user.picture} alt="" className="size-6 rounded-full" />
            <span className="text-foreground hidden font-medium sm:inline">{dashboard.user.login}</span>
          </span>
        )
      }
      className="max-w-4xl"
    >
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

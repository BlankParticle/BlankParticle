import {
  Brand,
  navLinkActiveClass,
  navLinkClass,
  navLinkInactiveClass,
} from "@blankparticle/ui/components/app-shell.tsx";
import { PlanetIcon } from "@blankparticle/ui/icons";
import { Link } from "@tanstack/react-router";

import { LiveTime } from "./live-time.tsx";

const navLinks = [
  { to: "/blog", label: "Blog" },
  { to: "/links", label: "Links" },
] as const;

/** Slim masthead on every page: the wordmark, the same nav links as the internal apps, and my local time */
export function SiteHeader() {
  return (
    // full width, scrolling with the page. One frosted layer (slightly opaque paper, light blur) sits behind it and
    // runs 2rem past its bottom edge, fading out there, so the header melts into the page with no seam or border
    <header className="relative isolate">
      <div
        className="bg-background/70 absolute inset-x-0 top-0 -z-10 h-[calc(100%+2rem)] [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)] backdrop-blur-sm"
        aria-hidden="true"
      />
      <div className="animate-reveal mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-5 motion-reduce:animate-none sm:px-8">
        <Link to="/" className="rounded-md">
          <Brand icon={<PlanetIcon weight="bold" />} />
        </Link>
        <nav className="ml-auto flex items-center gap-0.5">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={navLinkClass}
              inactiveProps={{ className: navLinkInactiveClass }}
              activeProps={{ className: navLinkActiveClass }}
            >
              {label}
            </Link>
          ))}
        </nav>
        {/* reserve the clock's width so the nav does not shift when it fades in after hydration */}
        <span className="hidden w-28 justify-end sm:flex">
          <LiveTime />
        </span>
      </div>
    </header>
  );
}

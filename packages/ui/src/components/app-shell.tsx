import type * as React from "react";

import { cn } from "#/lib/utils.ts";

/**
 * Chrome shared by the internal apps: a slim sticky header with brand, navigation
 * and an actions slot, then a centered content column.
 */
function AppShell({
  brand,
  nav,
  actions,
  children,
  className,
}: {
  brand: React.ReactNode;
  nav?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background/85 supports-backdrop-filter:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          {brand}
          {nav && <nav className="flex items-center gap-0.5">{nav}</nav>}
          {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10", className)}>{children}</main>
    </div>
  );
}

/** Wordmark: a small violet tile plus `blankparticle`, or `blankparticle / <product>` */
function Brand({ icon, product }: { icon: React.ReactNode; product?: string }) {
  return (
    <span className="font-heading inline-flex items-center gap-2.5 text-sm font-semibold">
      <span className="bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-md *:size-4">
        {icon}
      </span>
      <span>blankparticle{product && <span className="text-muted-foreground font-medium"> / {product}</span>}</span>
    </span>
  );
}

/**
 * Class names for router links inside `AppShell`'s nav slot. Keep the state
 * classes in `inactiveProps` / `activeProps` — a link must never carry both
 * sets, or their hover utilities fight and stylesheet order picks the winner.
 */
const navLinkClass =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors [&_svg]:size-4";
const navLinkInactiveClass = "text-muted-foreground hover:bg-muted hover:text-foreground";
const navLinkActiveClass = "bg-secondary text-foreground";

export { AppShell, Brand, navLinkActiveClass, navLinkClass, navLinkInactiveClass };

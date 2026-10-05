import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PageBackdrop } from "./page-backdrop.tsx";
import { SiteFooter } from "./site-footer.tsx";
import { SiteHeader } from "./site-header.tsx";

/**
 * Every page shares one column and one vertical rhythm: the full-width masthead, then sections
 * separated by a fixed gap, then (on the home page only) the footer. Sections do not pad themselves.
 */
export function SiteLayout({ children }: { children: ReactNode }) {
  const isHome = useRouterState({ select: (state) => state.location.pathname === "/" });
  return (
    <div className="flex min-h-screen flex-col">
      <PageBackdrop className="h-[60rem] opacity-50 sm:h-[54rem]" />
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 sm:px-8">
        <main className="flex flex-1 flex-col gap-12 py-12 sm:gap-16 sm:py-16">{children}</main>
        {isHome && <SiteFooter />}
      </div>
    </div>
  );
}

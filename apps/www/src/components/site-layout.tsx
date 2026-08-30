import type { ReactNode } from "react";

import { SiteHeader } from "./site-header.tsx";

/**
 * Every page shares one column and one vertical rhythm: the masthead, then sections
 * separated by a fixed gap. Sections do not pad themselves.
 */
export function SiteLayout({ back, children }: { back?: { to: "/" | "/blog"; label: string }; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 pb-16 sm:px-8">
      <SiteHeader {...(back ? { back } : {})} />
      <div className="flex flex-1 flex-col gap-12 py-12 sm:gap-16 sm:py-16">{children}</div>
    </main>
  );
}

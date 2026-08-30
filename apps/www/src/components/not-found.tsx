import { Button } from "@blankparticle/ui/primitives/button.tsx";

import { SiteLayout } from "./site-layout.tsx";

export function NotFound() {
  return (
    <SiteLayout>
      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="reveal relative flex flex-col items-center gap-2">
          <span className="halftone text-orange absolute -top-6 -right-10 size-28" aria-hidden="true" />
          <span className="halftone text-primary absolute -bottom-4 -left-10 size-20" aria-hidden="true" />
          <span className="eyebrow text-orange-deep relative">Error 404</span>
          <h1 className="text-display-lg text-primary relative font-extrabold">
            4
            <span className="text-orange-deep inline-block -translate-y-2 rotate-12 transition-transform duration-300 hover:translate-y-0 hover:rotate-0">
              0
            </span>
            4
          </h1>
        </div>

        <p className="reveal reveal-90 text-muted-foreground max-w-md">
          There is nothing at this address. It may have moved, or it may never have{" "}
          <span className="marker text-foreground font-bold">existed</span> at all.
        </p>

        <div className="reveal reveal-180 flex flex-wrap items-center justify-center gap-4">
          <Button variant="sticker-primary" size="xl" nativeButton={false} render={<a href="/" />}>
            Take me home
          </Button>
          <Button
            variant="sticker-accent"
            size="xl"
            nativeButton={false}
            render={<a href="/gh" target="_blank" rel="nofollow noopener noreferrer" />}
          >
            Find me on GitHub
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}

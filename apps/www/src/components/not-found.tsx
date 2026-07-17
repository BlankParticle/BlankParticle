import { LiveTime } from "./live-time.tsx";
import { Button } from "./ui/button.tsx";

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 pb-16 sm:px-8">
      <header className="animate-reveal border-violet/35 text-violet flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed py-4 text-xs font-bold tracking-[0.18em] uppercase motion-reduce:animate-none">
        <span>blankparticle.com</span>
        <span className="text-orange-deep hidden sm:inline">lost &amp; found dept.</span>
        <span>
          my time: <LiveTime /> ist
        </span>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center">
        <div className="animate-reveal relative motion-reduce:animate-none">
          <span
            className="text-orange absolute -top-8 -right-10 size-28 rounded-full bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-size-[9px_9px]"
            aria-hidden="true"
          ></span>
          <span
            className="text-violet absolute -bottom-6 -left-10 size-20 rounded-full bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-size-[9px_9px]"
            aria-hidden="true"
          ></span>
          <h1 className="font-display text-violet relative text-[clamp(6rem,20vw,12rem)] leading-none font-extrabold tracking-tight">
            4<span className="text-orange-deep inline-block rotate-3">0</span>4
          </h1>
          <span className="border-ink bg-lime absolute -bottom-2 left-1/2 w-max -translate-x-1/2 -rotate-2 border-2 px-2 py-0.5 text-xs font-bold tracking-widest uppercase">
            page not found
          </span>
        </div>

        <p className="animate-reveal text-ink-muted max-w-md text-base [animation-delay:180ms] motion-reduce:animate-none">
          This page got lost in the print run. Maybe it was never
          <span className="text-ink before:bg-lime relative mx-1 inline-block font-bold before:absolute before:-inset-x-0.75 before:inset-y-px before:-z-10 before:-rotate-1">
            printed
          </span>
          at all.
        </p>

        <div className="animate-reveal flex flex-wrap items-center justify-center gap-4 [animation-delay:270ms] motion-reduce:animate-none">
          <Button variant="violet" nativeButton={false} render={<a href="/" />}>
            take me home
          </Button>
          <Button
            variant="orange"
            nativeButton={false}
            render={<a href="/gh" target="_blank" rel="noopener noreferrer" />}
          >
            find me on github
          </Button>
        </div>
      </section>

      <footer className="animate-reveal border-violet/35 flex justify-center border-t-2 border-dashed pt-6 text-center text-xs font-bold [animation-delay:360ms] motion-reduce:animate-none">
        <span className="border-orange-deep text-orange-deep -rotate-2 rounded border-2 border-dashed px-2 py-1 tracking-[0.18em] uppercase">
          error 404 · misprint
        </span>
      </footer>
    </main>
  );
}

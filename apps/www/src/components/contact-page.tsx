import { Button } from "@blankparticle/ui/components/button.tsx";
import { Link } from "@tanstack/react-router";

import { CopyButton } from "./copy-button.tsx";
import { LiveTime } from "./live-time.tsx";
import type { ContactInfo } from "./social-modals.tsx";

export function ContactPage({ contact, stamp }: { contact: ContactInfo; stamp: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 pb-16 sm:px-8">
      <header className="animate-reveal border-violet/35 text-violet flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed py-4 text-xs font-bold tracking-[0.18em] uppercase motion-reduce:animate-none">
        <Link to="/" className="hover:text-orange-deep transition-colors">
          ← blankparticle.com
        </Link>
        <span>
          my time: <LiveTime /> ist
        </span>
      </header>

      <section className="flex flex-1 items-center justify-center py-16">
        <div className="animate-reveal relative w-full max-w-md [animation-delay:90ms] motion-reduce:animate-none">
          <span
            className="text-orange absolute -top-8 -right-6 size-24 rounded-full bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-size-[9px_9px]"
            aria-hidden="true"
          ></span>
          <span
            className="text-violet absolute -bottom-6 -left-7 size-20 rounded-full bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-size-[9px_9px]"
            aria-hidden="true"
          ></span>
          <div className="border-ink bg-paper relative -rotate-1 rounded-2xl border-2 p-6 shadow-[6px_6px_0_var(--color-violet)] sm:p-8">
            <h1 className="font-display text-violet text-3xl font-extrabold tracking-tight">{contact.title}</h1>
            <p className="text-ink-muted pt-2 text-sm">{contact.description}</p>
            <div className="border-violet/50 bg-lime/20 mt-6 flex items-center gap-3 rounded-md border-2 border-dashed px-4 py-3">
              <span className="text-ink min-w-0 truncate font-bold">{contact.value}</span>
              <CopyButton value={contact.value} label={contact.copyLabel} />
            </div>
            {contact.actions && contact.actions.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                {contact.actions.map((action) => (
                  <Button
                    key={action.label}
                    variant="violet"
                    className="flex-1 whitespace-nowrap"
                    nativeButton={false}
                    render={<a href={action.href} target="_blank" rel="noopener noreferrer" />}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="animate-reveal border-violet/35 flex justify-center border-t-2 border-dashed pt-6 text-center text-xs font-bold [animation-delay:180ms] motion-reduce:animate-none">
        <span className="border-orange-deep text-orange-deep -rotate-2 rounded border-2 border-dashed px-2 py-1 tracking-[0.18em] uppercase">
          {stamp}
        </span>
      </footer>
    </main>
  );
}

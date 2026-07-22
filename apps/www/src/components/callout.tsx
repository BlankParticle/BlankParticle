import type { PropsWithChildren } from "react";

export function Callout({ emoji, children }: PropsWithChildren<{ emoji: string }>) {
  return (
    <aside className="border-ink bg-lime/25 relative mt-(--typeset-flow) flex items-start gap-4 rounded-xl border-2 px-4 py-4 shadow-[4px_4px_0_var(--color-violet)] sm:px-5">
      <span
        aria-hidden="true"
        className="border-ink bg-paper grid size-10 shrink-0 -rotate-3 place-items-center rounded-lg border-2 text-xl leading-none shadow-[2px_2px_0_var(--color-orange)]"
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1 text-[0.95em] leading-relaxed *:first:mt-0">{children}</div>
    </aside>
  );
}

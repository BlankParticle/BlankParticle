import type { PropsWithChildren } from "react";

export function Callout({ emoji, children }: PropsWithChildren<{ emoji: string }>) {
  return (
    <aside className="sticker sticker-lg sticker-primary bg-card mt-(--typeset-flow) flex items-start gap-4 rounded-xl px-4 py-4 sm:px-5">
      <span
        aria-hidden="true"
        className="bg-highlight border-foreground grid size-10 shrink-0 place-items-center rounded-lg border-2 text-xl leading-none"
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed *:first:mt-0">{children}</div>
    </aside>
  );
}

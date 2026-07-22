import type { PropsWithChildren } from "react";

interface GistProps {
  filename: string;
  href: string;
}

export function Gist({ filename, href, children }: PropsWithChildren<GistProps>) {
  return (
    <details className="group/gist border-ink bg-paper mt-(--typeset-flow) overflow-hidden rounded-xl border-2 shadow-[4px_4px_0_var(--color-violet)]">
      <summary className="group-open/gist:border-violet/35 group-open/gist:bg-lime/15 hover:bg-lime/20 flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 select-none group-open/gist:border-b-2 group-open/gist:border-dashed sm:px-5 [&::-webkit-details-marker]:hidden">
        <span
          className="border-ink bg-violet text-paper grid size-9 shrink-0 -rotate-2 place-items-center rounded-lg border-2 shadow-[2px_2px_0_var(--color-orange)]"
          aria-hidden="true"
        >
          <svg className="size-4.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.74-1.55-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05a4.45 4.45 0 0 1 1.19 3.09c0 4.41-2.7 5.39-5.28 5.68.42.36.78 1.06.78 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0 leading-none">
          <span className="text-orange-deep text-[0.6rem] font-bold tracking-[0.18em] uppercase">GitHub Gist</span>
          <code className="text-violet mt-1 truncate bg-transparent p-0 text-sm font-bold">{filename}</code>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-ink-muted/70 hidden text-[0.6rem] font-bold tracking-[0.14em] uppercase group-open/gist:hidden sm:inline">
            view code
          </span>
          <span className="text-ink-muted/70 hidden text-[0.6rem] font-bold tracking-[0.14em] uppercase sm:group-open/gist:inline">
            hide code
          </span>
          <span
            className="text-orange-deep text-lg leading-none transition-transform duration-200 group-open/gist:rotate-90"
            aria-hidden="true"
          >
            ▸
          </span>
        </span>
      </summary>

      <div className="[&_pre]:mt-0 [&_pre]:max-h-128 [&_pre]:rounded-none [&_pre]:border-0">{children}</div>
      <footer className="border-violet/25 flex justify-end border-t-2 border-dashed px-4 py-2.5">
        <a
          className="text-orange-deep text-[0.65rem] font-bold tracking-[0.14em] uppercase"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          View the original gist <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </details>
  );
}

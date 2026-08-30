import type { PropsWithChildren } from "react";

interface GistProps {
  filename: string;
  href: string;
}

export function Gist({ filename, href, children }: PropsWithChildren<GistProps>) {
  return (
    <details className="gist group/gist bg-card ring-foreground/10 mt-(--typeset-flow) overflow-hidden rounded-xl ring-1">
      <summary className="hover:bg-muted/60 group-open/gist:rule-dots flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors select-none group-open/gist:border-b-2 sm:px-5">
        <span
          className="bg-muted text-foreground grid size-8 shrink-0 place-items-center rounded-md border"
          aria-hidden="true"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.74-1.55-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05a4.45 4.45 0 0 1 1.19 3.09c0 4.41-2.7 5.39-5.28 5.68.42.36.78 1.06.78 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
          <span className="eyebrow text-orange-deep">GitHub Gist</span>
          <code className="truncate bg-transparent p-0 font-mono text-sm font-medium">{filename}</code>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="eyebrow text-muted-foreground hidden group-open/gist:hidden sm:inline">view code</span>
          <span className="eyebrow text-muted-foreground hidden sm:group-open/gist:inline">hide code</span>
          <span
            className="text-muted-foreground text-base leading-none transition-transform duration-200 group-open/gist:rotate-90"
            aria-hidden="true"
          >
            ▸
          </span>
        </span>
      </summary>

      <div className="gist-body">{children}</div>
      <footer className="rule-dots flex justify-end border-t-2 px-4 py-2.5">
        <a className="eyebrow link-dots text-orange-deep" href={href} target="_blank" rel="noopener noreferrer">
          View the original gist <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </details>
  );
}

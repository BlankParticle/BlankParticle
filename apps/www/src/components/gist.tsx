import type { PropsWithChildren } from "react";

import { GitHubIcon } from "#/assets/social-icons.tsx";

interface GistProps {
  filename: string;
  href: string;
}

export function Gist({ filename, href, children }: PropsWithChildren<GistProps>) {
  return (
    <details className="gist group/gist bg-card ring-foreground/10 mt-(--typeset-flow) overflow-hidden rounded-xl ring-1">
      <summary className="hover:bg-muted/60 group-open/gist:rule-dots flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors select-none group-open/gist:border-b-2 sm:px-5">
        <span
          className="bg-muted text-foreground grid size-8 shrink-0 place-items-center rounded-md border *:size-4"
          aria-hidden="true"
        >
          <GitHubIcon fill="currentColor" />
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

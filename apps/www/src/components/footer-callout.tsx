import type { ReactNode } from "react";

interface FooterCalloutProps {
  icon: ReactNode;
  href: string;
  label: string;
  subtext: string;
  subtextHref?: string;
}

export function FooterCallout({ icon, href, label, subtext, subtextHref }: FooterCalloutProps) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}

      <span className="flex flex-col items-start gap-0.5 text-left">
        <a
          href={href}
          className="text-violet decoration-orange decoration-wavy underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
        {subtextHref ? (
          <a
            href={subtextHref}
            className="text-ink-muted/70 text-[10px] tracking-wide underline decoration-dotted underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {subtext}
          </a>
        ) : (
          <span className="text-ink-muted/70 text-[10px] tracking-wide">{subtext}</span>
        )}
      </span>
    </div>
  );
}

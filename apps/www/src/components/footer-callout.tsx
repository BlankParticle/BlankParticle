import type { ReactNode } from "react";

interface FooterCalloutProps {
  icon: ReactNode;
  href: string;
  label: string;
  /** what phones show instead of `label`, where the cards shrink to small tiles */
  shortLabel: string;
  subtext: string;
  subtextHref?: string;
}

export function FooterCallout({ icon, href, label, shortLabel, subtext, subtextHref }: FooterCalloutProps) {
  return (
    // phones: a small tile, icon over a short label; wider screens: icon beside the label and its subtext
    <div className="bg-card flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center sm:flex-row sm:gap-2.5 sm:px-3.5 sm:text-left">
      {icon}

      <span className="flex flex-col items-center gap-0.5 sm:items-start">
        <a
          href={href}
          className="link-dots font-semibold"
          target="_blank"
          rel={href.startsWith("/") ? "nofollow noopener noreferrer" : "noopener noreferrer"}
        >
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </a>
        {subtextHref ? (
          <a
            href={subtextHref}
            className="text-muted-foreground hover:text-foreground text-2xs hidden transition-colors sm:inline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {subtext}
          </a>
        ) : (
          <span className="text-muted-foreground text-2xs hidden sm:inline">{subtext}</span>
        )}
      </span>
    </div>
  );
}

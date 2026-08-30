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
    <div className="bg-card flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5">
      {icon}

      <span className="flex flex-col items-start gap-0.5 text-left">
        <a
          href={href}
          className="link-dots font-semibold"
          target="_blank"
          rel={href.startsWith("/") ? "nofollow noopener noreferrer" : "noopener noreferrer"}
        >
          {label}
        </a>
        {subtextHref ? (
          <a
            href={subtextHref}
            className="text-muted-foreground hover:text-foreground text-2xs transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            {subtext}
          </a>
        ) : (
          <span className="text-muted-foreground text-2xs">{subtext}</span>
        )}
      </span>
    </div>
  );
}

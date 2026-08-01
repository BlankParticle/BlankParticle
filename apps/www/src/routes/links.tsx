import { cn } from "@blankparticle/ui/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";

import { AppIcon } from "@/components/app-icon.tsx";
import { LiveTime } from "@/components/live-time.tsx";
import { discordContact, emailContact } from "@/components/social-modals.tsx";
import { personLd, SITE_URL, socials } from "@/lib/data.ts";

const pageTitle = "links · blankparticle";
const pageDescription = "Every place you can find me, all on one page.";
const pageUrl = `${SITE_URL}/links`;

interface LinkEntry {
  label: string;
  href: string;
  subtext: string;
  external: boolean;
  icon?: ComponentType | undefined;
  iconBackground?: string | undefined;
}

// socials with a modal have their own standalone page on this site instead of a shortlink
const contactPages: Record<string, { href: string; subtext: string }> = {
  Email: { href: "/email", subtext: emailContact.value },
  Discord: { href: "/discord", subtext: `@${discordContact.value}` },
};

const links: LinkEntry[] = [
  ...socials.map((social) => ({
    label: social.label,
    href: contactPages[social.label]?.href ?? social.shortLink[0],
    subtext: contactPages[social.label]?.subtext ?? social.url.replace(/^https:\/\//, "").replace(/\/$/, ""),
    external: !social.modal,
    icon: social.icon,
    iconBackground: social.iconBackground,
  })),
  { label: "Blog", href: "/blog", subtext: "blankparticle.com/blog", external: false },
];

const linkTilts = ["-rotate-1", "rotate-1", "rotate-0", "-rotate-1", "rotate-1"];

const linkShadows = [
  "shadow-[4px_4px_0_var(--color-violet)] hover:shadow-[2px_2px_0_var(--color-violet)]",
  "shadow-[4px_4px_0_var(--color-orange)] hover:shadow-[2px_2px_0_var(--color-orange)]",
];

export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:url", content: pageUrl },
      { property: "twitter:url", content: pageUrl },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: pageDescription },
    ],
    links: [{ rel: "canonical", href: pageUrl }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({ "@context": "https://schema.org", ...personLd }),
      },
    ],
  }),
  component: LinksPage,
});

function LinksPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 pb-16 sm:px-8">
      <header className="animate-reveal border-violet/35 text-violet flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed py-4 text-xs font-bold tracking-[0.18em] uppercase motion-reduce:animate-none">
        <Link to="/" className="hover:text-orange-deep transition-colors">
          ← blankparticle.com
        </Link>
        <span className="text-orange-deep hidden sm:inline">the link tree · fully grown</span>
        <span>
          my time: <LiveTime /> ist
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-8 py-12 sm:py-16">
        <figure className="animate-reveal group relative [animation-delay:90ms] motion-reduce:animate-none">
          <img
            src="/me.png"
            alt="Rahul, cut out and stuck on the page like a sticker"
            className="border-paper relative size-28 rotate-2 rounded-2xl border-4 object-cover shadow-[0_0_0_2px_var(--color-ink)] transition-transform duration-300 ease-out select-none group-hover:rotate-0"
          />
          <figcaption className="border-ink bg-lime absolute -bottom-3 left-1/2 w-max -translate-x-1/2 -rotate-2 border-2 px-2 py-0.5 text-xs font-bold tracking-widest uppercase">
            @blankparticle
          </figcaption>
        </figure>

        <div className="animate-reveal flex flex-col gap-2 text-center [animation-delay:180ms] motion-reduce:animate-none">
          <h1 className="font-display text-violet text-4xl font-extrabold tracking-tight">Rahul Mishra</h1>
          <p className="text-ink-muted text-sm">{pageDescription}</p>
        </div>

        <ol className="flex w-full flex-col gap-5">
          {links.map((link, i) => (
            <li
              key={link.label}
              className="animate-reveal motion-reduce:animate-none"
              style={{ animationDelay: `${270 + i * 60}ms` }}
            >
              <a
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}
                className={cn(
                  "group border-ink bg-paper relative flex w-full items-center gap-3 rounded-xl border-2 px-5 py-3.5 transition-all before:absolute before:-inset-1 hover:translate-x-[2px] hover:translate-y-[2px]",
                  linkTilts[i % linkTilts.length],
                  linkShadows[i % linkShadows.length],
                )}
              >
                {link.icon && (
                  <AppIcon className={cn("size-9 [&_svg]:size-6!", link.iconBackground)}>
                    <link.icon />
                  </AppIcon>
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink font-bold">{link.label}</span>
                  <span className="text-ink-muted truncate text-xs">{link.subtext}</span>
                </span>
                <span
                  className="text-orange-deep ml-auto shrink-0 text-lg font-bold transition-transform duration-200 ease-out group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <footer className="animate-reveal border-violet/35 flex justify-center border-t-2 border-dashed pt-6 text-center text-xs font-bold [animation-delay:360ms] motion-reduce:animate-none">
        <span className="border-orange-deep text-orange-deep -rotate-2 rounded border-2 border-dashed px-2 py-1 tracking-[0.18em] uppercase">
          that's everything · promise
        </span>
      </footer>
    </main>
  );
}

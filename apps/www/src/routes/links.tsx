import { ArrowRightIcon } from "@blankparticle/ui/icons";
import { cn } from "@blankparticle/ui/utils";
import { createFileRoute } from "@tanstack/react-router";
import type { ComponentType } from "react";

import { AppIcon } from "#/components/app-icon.tsx";
import { SiteLayout } from "#/components/site-layout.tsx";
import { discordContact, emailContact } from "#/components/social-modals.tsx";
import { personLd, SITE_URL, socials } from "#/lib/data.ts";

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

/** Cards alternate the ink of their offset shadow */
const cardInks = ["sticker-primary", "sticker-orange"];

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
    <SiteLayout back={{ to: "/", label: "blankparticle.com" }}>
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-8">
        <img
          src="/me.png"
          alt="Rahul Mishra"
          className="reveal reveal-90 size-28 rotate-3 transition-transform duration-300 ease-out select-none hover:rotate-0"
        />

        <div className="reveal reveal-180 flex flex-col gap-1.5 text-center">
          <h1 className="text-primary text-4xl font-extrabold">Rahul Mishra</h1>
          <p className="text-muted-foreground text-sm">{pageDescription}</p>
        </div>

        <ol className="flex w-full flex-col gap-4">
          {links.map((link, i) => (
            <li key={link.label} className="reveal" style={{ animationDelay: `${270 + i * 60}ms` }}>
              <a
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}
                className={cn(
                  "group sticker sticker-lg sticker-press bg-card flex w-full items-center gap-3 rounded-xl px-5 py-3.5",
                  cardInks[i % cardInks.length],
                )}
              >
                {link.icon && (
                  <AppIcon size="md" className={link.iconBackground}>
                    <link.icon />
                  </AppIcon>
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="font-heading font-bold">{link.label}</span>
                  <span className="text-muted-foreground truncate text-xs">{link.subtext}</span>
                </span>
                <ArrowRightIcon
                  weight="bold"
                  className="text-orange-deep ml-auto size-5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ol>
      </section>
    </SiteLayout>
  );
}

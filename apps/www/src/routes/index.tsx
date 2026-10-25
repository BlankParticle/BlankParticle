import { ArrowRightIcon, ArrowUpRightIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import avatarUrl from "#/assets/avatar.webp";
import { AppIcon } from "#/components/app-icon.tsx";
import { Marquee } from "#/components/marquee.tsx";
import { SectionHeading } from "#/components/section-heading.tsx";
import { SocialLink, stickerInks } from "#/components/social-link.tsx";
import { ContactDialog } from "#/components/social-modals.tsx";
import { WorkHistory } from "#/components/work-history.tsx";
import { emailContact, type Contact } from "#/lib/contacts.ts";
import { socials, workHistory } from "#/lib/data.ts";
import { personLd, seo, SITE_DESCRIPTION, SITE_NAME } from "#/lib/site.ts";

const tickerWords = [
  "curious",
  "tinkerer",
  "builds for fun",
  "open source",
  "probably debugging",
  "say hi",
  "always learning",
  "breaks things to fix them",
  "loves a good refactor",
  "ships it",
  "reads the source",
  "automates the boring",
  "late night commits",
];

export const Route = createFileRoute("/")({
  head: () => ({
    ...seo({ title: SITE_NAME, description: SITE_DESCRIPTION, path: "/" }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({ "@context": "https://schema.org", ...personLd }),
      },
    ],
  }),
  loader: () => ({ age: new Date().getFullYear() - 2005 }),
  component: HomePage,
});

function HomePage() {
  const { age } = Route.useLoaderData();
  const [openContact, setOpenContact] = useState<Contact | null>(null);

  const stickers = socials.filter((x) => x.showAsSticker !== false);

  return (
    <>
      <section className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-xl flex-col gap-5">
          <p className="reveal reveal-90 eyebrow text-orange-deep">Hello, I'm</p>
          <h1 className="reveal reveal-180 text-display text-primary font-extrabold">Rahul Mishra</h1>
          <p className="reveal reveal-270 text-muted-foreground leading-relaxed">
            also known as{" "}
            <a href="/gh" rel="nofollow" className="marker text-foreground font-bold">
              @blankparticle
            </a>{" "}
            online. {/* rendered on the server, which may be a new year behind the visitor */}
            {age} years old, software developer, and forever taking software apart to see how it works. Sometimes I
            write about it on{" "}
            <Link to="/blog" className="link-dots text-foreground font-bold">
              the blog
            </Link>{" "}
            too.
          </p>
          <div className="reveal reveal-360 flex flex-wrap items-center gap-4 pt-2">
            <Button variant="sticker-primary" size="xl" onClick={() => setOpenContact(emailContact)}>
              Email me
            </Button>
            <Button variant="sticker-accent" size="xl" nativeButton={false} render={<a href="/cal" rel="nofollow" />}>
              Book a call
            </Button>
            <Button
              variant="sticker"
              size="xl"
              nativeButton={false}
              render={<a href="/resume" target="_blank" rel="nofollow noopener noreferrer" />}
            >
              Resume <ArrowUpRightIcon weight="bold" />
            </Button>
          </div>
        </div>

        <figure className="reveal reveal-270 relative order-first shrink-0 self-center md:order-0 md:self-auto">
          <span className="halftone text-orange absolute -top-4 -right-5 size-28" aria-hidden="true" />
          <span className="halftone text-primary absolute -bottom-4 -left-6 size-20" aria-hidden="true" />
          <img
            src={avatarUrl}
            alt="Rahul Mishra"
            width={400}
            height={400}
            fetchPriority="high"
            className="relative size-44 rotate-3 transition-transform duration-300 ease-out select-none hover:rotate-0 sm:size-52"
          />
        </figure>
      </section>

      <Marquee tickers={tickerWords} />

      <section className="reveal reveal-540 flex flex-col">
        <SectionHeading>Where I've worked</SectionHeading>
        <WorkHistory items={workHistory} />
      </section>

      <section className="reveal reveal-630 flex flex-col">
        <SectionHeading>Find me around</SectionHeading>
        <div className="flex flex-wrap gap-x-3 gap-y-4">
          {stickers.map(({ contact, ...social }, i) => (
            <SocialLink
              key={social.label}
              name={social.label}
              ink={stickerInks[i % stickerInks.length]!}
              icon={
                social.icon ? (
                  <AppIcon className={social.iconBackground}>
                    <social.icon />
                  </AppIcon>
                ) : null
              }
              {...(contact ? { onClick: () => setOpenContact(contact) } : { href: social.shortLink[0] })}
            />
          ))}
          <Button
            variant="outline"
            size="lg"
            className="group border-primary/60 text-primary hover:border-primary hover:bg-primary/8 rounded-full border-2 border-dashed bg-transparent px-4 font-semibold"
            nativeButton={false}
            render={<Link to="/links" />}
          >
            All my links
            <ArrowRightIcon weight="bold" className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </div>
      </section>

      {socials.map(
        ({ contact }) =>
          contact && (
            <ContactDialog
              key={contact.page}
              contact={contact}
              open={openContact === contact}
              onClose={() => setOpenContact(null)}
            />
          ),
      )}
    </>
  );
}

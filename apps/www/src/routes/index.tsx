import { ArrowRightIcon, ArrowUpRightIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { CloudflareWorkersIcon, GitHubIcon, TanStackIcon } from "@/assets/social-icons.tsx";
import { AppIcon } from "@/components/app-icon.tsx";
import { FooterCallout } from "@/components/footer-callout.tsx";
import { Marquee } from "@/components/marquee.tsx";
import { SectionHeading } from "@/components/section-heading.tsx";
import { SiteLayout } from "@/components/site-layout.tsx";
import { SocialLink, stickerInks } from "@/components/social-link.tsx";
import { WorkHistory } from "@/components/work-history.tsx";
import { personLd, projects, SITE_URL, socials, workHistory } from "@/lib/data.ts";

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
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({ "@context": "https://schema.org", ...personLd }),
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const age = new Date().getFullYear() - 2005;

  const [openModal, setOpenModal] = useState<string | null>(null);

  const stickers = socials.filter((x) => x.showAsSticker !== false);

  return (
    <>
      <SiteLayout>
        <section className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-5">
            <p className="reveal reveal-90 eyebrow text-orange-deep">Hello, I'm</p>
            <h1 className="reveal reveal-180 text-display text-primary font-extrabold">Rahul Mishra</h1>
            <p className="reveal reveal-270 text-muted-foreground leading-relaxed">
              also known as{" "}
              <a href="/gh" rel="nofollow" className="marker text-foreground font-bold">
                @blankparticle
              </a>{" "}
              online. {age} years old, software developer, and forever taking software apart to see how it works.
              Sometimes I write about it on{" "}
              <Link to="/blog" className="link-dots text-foreground font-bold">
                the blog
              </Link>{" "}
              too.
            </p>
            <div className="reveal reveal-360 flex flex-wrap items-center gap-4 pt-2">
              <Button variant="sticker-primary" size="xl" onClick={() => setOpenModal("Email")}>
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
              src="/me.png"
              alt="Rahul Mishra"
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
          <SectionHeading>Things I've built</SectionHeading>
          <ol className="rule-dots flex flex-col border-t-2">
            {projects.map((project, i) => (
              <li key={project.title} className="rule-dots border-b-2">
                <a
                  className="group list-row flex items-baseline gap-4 py-5 sm:gap-6"
                  href={project.url}
                  target="_blank"
                  rel={project.url.startsWith("/") ? "nofollow noopener noreferrer" : "noopener noreferrer"}
                >
                  <span className="font-heading text-orange-deep text-xl font-bold tabular-nums" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-heading text-violet-deep group-hover:text-primary text-xl font-bold wrap-break-word transition-colors">
                      {project.title}
                    </span>
                    <span className="text-muted-foreground text-sm">{project.description}</span>
                  </span>
                  <ArrowUpRightIcon
                    weight="bold"
                    className="text-orange-deep ml-auto size-5 shrink-0 self-center transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="reveal reveal-720 flex flex-col">
          <SectionHeading>Find me around</SectionHeading>
          <div className="flex flex-wrap gap-x-3 gap-y-4">
            {stickers.map((social, i) => (
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
                {...(social.modal ? { onClick: () => setOpenModal(social.label) } : { href: social.shortLink[0] })}
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

        <footer className="reveal reveal-810 flex flex-col flex-wrap items-center justify-center gap-x-8 gap-y-4 border-t pt-6 text-xs sm:flex-row">
          <FooterCallout
            icon={
              <AppIcon size="md" className="bg-[#1b1f23]">
                <GitHubIcon />
              </AppIcon>
            }
            href="/gh/BlankParticle"
            label="Made with 💜 by BlankParticle"
            subtext={`build ${import.meta.env.VITE_GIT_HASH}`}
            subtextHref={
              import.meta.env.VITE_GIT_HASH === "development"
                ? `https://github.com/BlankParticle/BlankParticle`
                : `https://github.com/BlankParticle/BlankParticle/commit/${import.meta.env.VITE_GIT_HASH}`
            }
          />
          <FooterCallout
            icon={
              <AppIcon size="md">
                <CloudflareWorkersIcon />
              </AppIcon>
            }
            href="https://workers.cloudflare.com"
            label="Powered by Cloudflare Workers"
            subtext="hosted on region earth 🌏"
          />
          <FooterCallout
            icon={
              <AppIcon size="md" className="*:size-8">
                <TanStackIcon />
              </AppIcon>
            }
            href="https://tanstack.com/start"
            label="Built with TanStack Start"
            subtext="the framework for full-stack apps"
          />
        </footer>
      </SiteLayout>

      {socials.map(
        (social) =>
          social.modal && (
            <social.modal key={social.label} open={openModal === social.label} onClose={() => setOpenModal(null)} />
          ),
      )}
    </>
  );
}

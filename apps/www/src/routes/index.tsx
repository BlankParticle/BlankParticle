import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CloudflareWorkersIcon, GitHubIcon, TanStackIcon } from "@/assets/social-icons.tsx";
import { AppIcon } from "@/components/app-icon.tsx";
import { FooterCallout } from "@/components/footer-callout.tsx";
import { LiveTime } from "@/components/live-time.tsx";
import { Marquee } from "@/components/marquee.tsx";
import { SocialSticker } from "@/components/social-sticker.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Button } from "@/components/ui/button.tsx";
import { projects, socials, workHistory } from "@/lib/data.ts";

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
  "breaking things",
  "shipping on fridays",
  "fixing other people's problems",
];

const stickerTilts = [
  "-rotate-2",
  "rotate-1",
  "rotate-2",
  "-rotate-1",
  "rotate-3",
  "-rotate-3",
  "rotate-1",
  "-rotate-2",
];

const stickerInks = [
  "border-violet text-violet hover:bg-violet hover:shadow-[4px_4px_0_var(--color-orange)]",
  "border-orange-deep text-orange-deep hover:bg-orange-deep hover:shadow-[4px_4px_0_var(--color-violet)]",
  "border-ink text-ink hover:bg-ink hover:shadow-[4px_4px_0_var(--color-orange)]",
];

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const age = new Date().getFullYear() - 2005;

  const [openModal, setOpenModal] = useState<string | null>(null);

  return (
    <>
      <main className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
        <header className="animate-reveal border-violet/35 text-violet flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed py-4 text-xs font-bold tracking-[0.18em] uppercase motion-reduce:animate-none">
          <span>blankparticle.com</span>
          <span className="text-orange-deep hidden sm:inline">est. 2005 · 100% handmade</span>
          <span>
            my time: <LiveTime /> ist
          </span>
        </header>

        <section className="flex flex-col gap-10 py-12 sm:py-16 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-5">
            <p className="animate-reveal text-ink-muted text-lg font-bold tracking-wide [animation-delay:90ms] motion-reduce:animate-none">
              Hello, I'm
            </p>
            <h1 className="animate-reveal font-display text-violet text-[clamp(3.5rem,9vw,6.5rem)] leading-[0.95] font-extrabold tracking-tight [animation-delay:180ms] motion-reduce:animate-none">
              Rahul Mishra
            </h1>
            <p className="animate-reveal text-ink-muted text-base [animation-delay:270ms] motion-reduce:animate-none">
              also known as
              <a
                href="/gh"
                className="text-ink before:bg-lime relative mx-1 inline-block font-bold before:absolute before:inset-x-[-3px] before:inset-y-px before:-z-10 before:-rotate-1 hover:before:rotate-1"
              >
                @blankparticle
              </a>
              online. {age} years old, software developer at{" "}
              <a
                href="https://iterate.com"
                className="text-orange-deep decoration-orange font-bold underline decoration-wavy decoration-2 underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                Iterate
              </a>
              , and forever taking software apart to see how it works.
            </p>
            <div className="animate-reveal flex flex-wrap items-center gap-4 pt-2 [animation-delay:360ms] motion-reduce:animate-none">
              <Button variant="violet" onClick={() => setOpenModal("Email")}>
                email me
              </Button>
              <Button variant="orange" nativeButton={false} render={<a href="/cal" />}>
                book a call
              </Button>
              <Button
                variant="violet-outline"
                nativeButton={false}
                render={<a href="/resume" target="_blank" rel="noopener noreferrer" />}
              >
                my resume
              </Button>
            </div>
          </div>

          <figure className="animate-reveal group relative order-first shrink-0 self-center [animation-delay:270ms] motion-reduce:animate-none md:order-0 md:self-auto">
            <span
              className="text-orange absolute -top-6 -right-6 size-28 rounded-full bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-size-[9px_9px]"
              aria-hidden="true"
            ></span>
            <span
              className="text-violet absolute -bottom-5 -left-7 size-20 rounded-full bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-size-[9px_9px]"
              aria-hidden="true"
            ></span>
            <img
              src="/me.png"
              alt="Rahul, cut out and stuck on the page like a sticker"
              className="border-paper relative size-40 rotate-2 rounded-2xl border-4 object-cover shadow-[0_0_0_2px_var(--color-ink)] transition-transform duration-300 ease-out select-none group-hover:rotate-0 sm:size-48"
            />
            <figcaption className="border-ink bg-lime absolute -bottom-3 left-1/2 w-max -translate-x-1/2 -rotate-2 border-2 px-2 py-0.5 text-xs font-bold tracking-widest uppercase">
              that's me
            </figcaption>
          </figure>
        </section>

        <Marquee tickers={tickerWords} />

        <section className="animate-reveal flex flex-col gap-2 py-12 [animation-delay:540ms] motion-reduce:animate-none sm:py-16">
          <div className="flex items-baseline justify-between gap-4 pb-4">
            <h2 className="font-display text-violet text-3xl font-extrabold tracking-tight sm:text-4xl">
              Where I've worked
            </h2>
            <span className="text-orange-deep text-xs font-bold tracking-[0.18em] uppercase">the paper trail</span>
          </div>
          <Accordion>
            {workHistory.map((work) => (
              <AccordionItem key={work.company} value={work.company}>
                <AccordionTrigger>
                  <AppIcon className="bg-ink size-10 -rotate-2 p-0.5 shadow-[2px_2px_0_var(--color-violet),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(0,0,0,0.15)]">
                    <img
                      src={work.logo}
                      alt={`${work.company} logo`}
                      loading="lazy"
                      className="size-full rounded-[22%] object-cover"
                    />
                  </AppIcon>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <a
                        href={work.url}
                        className="font-display text-violet-deep decoration-orange text-xl font-bold decoration-wavy underline-offset-4 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {work.company}
                      </a>
                      {work.companySubtext && <span className="text-ink-muted/70 text-xs">{work.companySubtext}</span>}
                    </span>
                    <span className="text-ink-muted text-sm">
                      {work.role} · {work.tags.join(" · ")}
                    </span>
                  </span>
                  <span className="font-display text-orange-deep ml-auto shrink-0 text-sm font-bold tabular-nums">
                    {work.date}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="flex flex-col gap-2">
                    {work.points.map((point) => (
                      <li key={point} className="text-ink-muted flex gap-2 text-sm">
                        <span className="text-orange-deep shrink-0 font-bold" aria-hidden="true">
                          →
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="animate-reveal flex flex-col gap-2 pb-12 [animation-delay:585ms] motion-reduce:animate-none sm:pb-16">
          <div className="flex items-baseline justify-between gap-4 pb-4">
            <h2 className="font-display text-violet text-3xl font-extrabold tracking-tight sm:text-4xl">
              Things I built
            </h2>
            <span className="text-orange-deep text-xs font-bold tracking-[0.18em] uppercase">hot off the press</span>
          </div>
          <ol className="flex flex-col">
            {projects.map((project, i) => (
              <li key={project.title} className="border-violet/35 border-t-2 border-dashed last:border-b-2">
                <a
                  className="group flex items-baseline gap-4 py-5 sm:gap-6"
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="font-display text-orange-deep text-xl font-bold tabular-nums" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-display text-violet-deep group-hover:decoration-orange text-xl font-bold wrap-break-word underline decoration-transparent decoration-2 underline-offset-4 transition-colors duration-200">
                      {project.title}
                    </span>
                    <span className="text-ink-muted text-sm">{project.description}</span>
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

        <section className="animate-reveal flex flex-col gap-6 pb-14 [animation-delay:630ms] motion-reduce:animate-none">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-violet text-3xl font-extrabold tracking-tight sm:text-4xl">
              Find me around
            </h2>
            <span className="text-orange-deep text-xs font-bold tracking-[0.18em] uppercase">socials sheet</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-4">
            {socials
              .filter((x) => x.showAsSticker !== false)
              .map((social, i) => {
                const tilt = stickerTilts[i % stickerTilts.length];
                const ink = stickerInks[i % stickerInks.length];
                return (
                  <SocialSticker
                    key={social.label}
                    name={social.label}
                    tilt={tilt}
                    ink={ink}
                    icon={
                      social.icon ? (
                        <AppIcon className={social.iconBackground}>
                          <social.icon />
                        </AppIcon>
                      ) : null
                    }
                    {...(social.modal ? { onClick: () => setOpenModal(social.label) } : { href: social.shortLink[0] })}
                  />
                );
              })}
          </div>
        </section>

        <footer className="animate-reveal border-violet/35 flex flex-col items-center gap-4 border-t-2 border-dashed pt-6 text-center text-xs font-bold [animation-delay:720ms] motion-reduce:animate-none sm:flex-row sm:flex-wrap sm:justify-between sm:text-left">
          <FooterCallout
            icon={
              <AppIcon className="size-9 bg-[#1b1f23] [&_svg]:size-6!">
                <GitHubIcon />
              </AppIcon>
            }
            href="/gh/BlankParticle"
            label="Made with 💜 by BlankParticle"
            subtext={`build commit ${import.meta.env.VITE_GIT_HASH}`}
            subtextHref={
              import.meta.env.VITE_GIT_HASH === "development"
                ? `https://github.com/BlankParticle/BlankParticle`
                : `https://github.com/BlankParticle/BlankParticle/commit/${import.meta.env.VITE_GIT_HASH}`
            }
          />
          <FooterCallout
            icon={
              <AppIcon className="size-9 [&_svg]:size-6!">
                <CloudflareWorkersIcon />
              </AppIcon>
            }
            href="https://workers.cloudflare.com"
            label="Powered by Cloudflare Workers"
            subtext="hosted on region earth 🌏"
          />
          <FooterCallout
            icon={
              <AppIcon className="size-9 [&_svg]:size-6!">
                <TanStackIcon />
              </AppIcon>
            }
            href="https://tanstack.com/start"
            label="Built with TanStack Start"
            subtext="the framework for full-stack apps"
          />
        </footer>
      </main>

      {socials.map(
        (social) =>
          social.modal && (
            <social.modal key={social.label} open={openModal === social.label} onClose={() => setOpenModal(null)} />
          ),
      )}
    </>
  );
}

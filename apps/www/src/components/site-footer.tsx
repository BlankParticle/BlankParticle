import { CloudflareWorkersIcon, GitHubIcon, TanStackIcon } from "#/assets/social-icons.tsx";

import { AppIcon } from "./app-icon.tsx";
import { FooterCallout } from "./footer-callout.tsx";

const gitHash = import.meta.env.VITE_GIT_HASH ?? "development";
const repo = "https://github.com/BlankParticle/BlankParticle";

/** Credits on every page: who made it, where it runs, and what it is built with */
export function SiteFooter() {
  return (
    // phones: three small tiles side by side; wider screens: the full cards, centred
    <footer className="grid grid-cols-3 gap-2 border-t py-6 text-xs sm:flex sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-4">
      <FooterCallout
        icon={
          <AppIcon size="md" className="bg-[#1b1f23]">
            <GitHubIcon />
          </AppIcon>
        }
        href="/gh/BlankParticle"
        label="Made with 💜 by BlankParticle"
        shortLabel="💜 BlankParticle"
        subtext={`build ${gitHash}`}
        subtextHref={gitHash === "development" ? repo : `${repo}/commit/${gitHash}`}
      />
      <FooterCallout
        icon={
          <AppIcon size="md">
            <CloudflareWorkersIcon />
          </AppIcon>
        }
        href="https://workers.cloudflare.com"
        label="Powered by Cloudflare Workers"
        shortLabel="Cloudflare"
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
        shortLabel="TanStack"
        subtext="the framework for full-stack apps"
      />
    </footer>
  );
}

import type { ComponentType } from "react";

import { DiscordModal, EmailModal, type SocialModalProps } from "../components/social-modals";

export const workHistory = [
  {
    role: "Software Engineer",
    company: "Iterate",
    logo: "https://github.com/iterate.png",
    url: "https://iterate.com",
    date: "Jun 2025 — Present",
    tags: ["Full-time", "Remote · UK"],
    points: [
      "Work across the stack — TanStack Start frontend, daemon backend architecture, build/deploy pipeline, and sandboxed environments for AI agents",
      "Built MCP servers/clients and a custom OAuth server for authentication",
      "Built integrations like Slack bots, OAuth logins, GitHub Apps, and auth bridges/workers",
      "Built and contributed to ecosystem tooling — safe-durable-objects, workers-sdk, alchemy and more",
    ],
  },
  {
    role: "Software Engineer",
    company: "Orchid",
    companySubtext: "prev. Mail0",
    logo: "https://github.com/Mail-0.png",
    url: "https://orchid.ai/",
    date: "Feb 2025 — May 2025",
    tags: ["Contract", "Remote · US"],
    points: [
      "Shipped the Cloudflare Workers backend, migrated the data layer from SWR to tRPC + TanStack Query, and restructured the codebase into a pnpm monorepo",
      "Rewrote the mail driver with full type safety and built a secure HTML email sanitizer and renderer",
      "Built a local query cache for faster load times, removed the Next.js proxy layer for direct API calls",
    ],
  },
  {
    role: "Software Engineer",
    company: "Unproprietary Corporation",
    companySubtext: "u22n",
    logo: "https://github.com/un.png",
    url: "https://github.com/un",
    date: "Feb 2024 — Sep 2024",
    tags: ["Part-time", "Remote · US"],
    points: [
      "Architected the email backend — ingestion, queue processing, SMTP delivery, and connectors for Google/Outlook on Railway",
      "Built a JS bridge into a Rails SMTP server to unblock product dev while a replacement was scoped",
      "Built the billing system, rich text editor with slash commands, OpenTelemetry instrumentation, and org/domain management",
      "Rewrote the Vue/Nuxt frontend as a React/Next.js app with TanStack Query, real-time sync, and an email-as-chat interface",
    ],
  },
];

export const projects = [
  {
    title: "gnome-bluetooth-quick-connect",
    description: "🔌 Allow to connect bluetooth paired devices from gnome control panel.",
    url: "/gh/gnome-bluetooth-quick-connect",
  },
  {
    title: "portable",
    description:
      "🚪 Run local apps behind the portable proxy, auto allocate ports, and expose friendly local hostnames",
    url: "/gh/portable",
  },
  {
    title: "tailwind-plugin-realtime-colors",
    description: "🧩 A Tailwind CSS plugin that allows you to load colors from URL of Realtime Colors",
    url: "/gh/tailwind-plugin-realtime-colors",
  },
  {
    title: "get-palette",
    description: "🎨 A simple JS library to get the dominant color or color palette of an image just by its URL.",
    url: "/gh/get-palette",
  },
  {
    title: "safe-durable-objects",
    description: "🔒 tRPC-style Safe RPC methods for Cloudflare Durable Objects",
    url: "https://github.com/iterate-com/safe-durable-objects",
  },
];

export interface Social {
  label: string;
  url: string;
  shortLink: string[];
  showAsSticker?: boolean;
  modal?: ComponentType<SocialModalProps>;
}

export const socials: Social[] = [
  {
    label: "Email",
    url: "https://mail.google.com/",
    shortLink: ["/email"],
    modal: EmailModal,
  },
  {
    label: "Twitter",
    url: "https://x.com/blankparticle",
    shortLink: ["/x", "/twitter"],
  },
  {
    label: "Discord",
    url: "https://discord.com/users/1096392763144159252",
    shortLink: ["/discord"],
    modal: DiscordModal,
  },
  {
    label: "GitHub",
    url: "https://github.com/BlankParticle",
    shortLink: ["/gh", "/github"],
  },
  {
    label: "Blog",
    url: "https://blog.blankparticle.in",
    shortLink: ["/blog"],
  },
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/blankparticle",
    shortLink: ["/linkedin"],
  },
  {
    label: "Spotify",
    url: "https://open.spotify.com/user/31krf3flzpa44udfgkc5a5xrqn7y",
    shortLink: ["/spotify"],
    showAsSticker: false,
  },
  {
    label: "Hashnode",
    url: "https://hashnode.com/@BlankParticle",
    shortLink: ["/hashnode"],
    showAsSticker: false,
  },
  {
    label: "Cal",
    url: "https://cal.com/blankparticle",
    shortLink: ["/cal"],
    showAsSticker: false,
  },
  {
    label: "Resume",
    url: "https://static.rx2.dev/docs/resume.pdf",
    shortLink: ["/resume"],
    showAsSticker: false,
  },
];

export const sshPublicKeys = {
  BlankParticle: [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHNDqiCnWAUMPjj4Q2Y2EjQrr6vF0etV1FCP3Nrus3ek",
    "hello@blankparticle.com",
  ],
  TechnicallyAnna: [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPF+GIrErl9gIe0E4tUE6+mQAQ0afuvoEbowZQ5bn9rd",
    "anna@blankparticle.com",
  ],
};

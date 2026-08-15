import type { ComponentType } from "react";

import AlchemyLogo from "../assets/companies/alchemy.png";
import IterateLogo from "../assets/companies/iterate.png";
import OrchidLogo from "../assets/companies/orchidhq.png";
import UnLogo from "../assets/companies/un.png";
import { DiscordIcon, GitHubIcon, GmailIcon, LinkedInIcon, XIcon } from "../assets/social-icons.tsx";
import { DiscordModal, EmailModal, type SocialModalProps } from "../components/social-modals";

export const SITE_URL = "https://blankparticle.com";

export const workHistory = [
  {
    role: "Software Engineer",
    company: "Alchemy",
    companySubtext: "Functionless Corp.",
    logo: AlchemyLogo,
    url: "https://alchemy.run",
    date: "Aug 2026 — Present",
    tags: ["Full-time", "Remote"],
    points: [
      "Building next-gen, Effect-native infrastructure-as-code tooling to model infra as composable, type-safe Effect code",
    ],
  },
  {
    role: "Software Engineer",
    company: "Iterate",
    logo: IterateLogo,
    url: "https://iterate.com",
    date: "Jun 2025 — Jul 2026",
    tags: ["Full-time", "Remote · UK"],
    points: [
      "Worked across the stack — TanStack Start frontend, daemon backend architecture, build/deploy pipeline, and sandboxed environments for AI agents",
      "Built MCP servers/clients and a custom OAuth server for authentication",
      "Built integrations like Slack bots, OAuth logins, GitHub Apps, and auth bridges/workers",
      "Built and contributed to ecosystem tooling — safe-durable-objects, workers-sdk, alchemy and more",
    ],
  },
  {
    role: "Software Engineer",
    company: "Orchid",
    companySubtext: "prev. Mail0",
    logo: OrchidLogo,
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
    logo: UnLogo,
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
  icon?: ComponentType;
  iconBackground?: string;
  modal?: ComponentType<SocialModalProps>;
}

export const socials: Social[] = [
  {
    label: "Email",
    icon: GmailIcon,
    url: "https://mail.google.com/",
    shortLink: [],
    modal: EmailModal,
  },
  {
    label: "Twitter",
    iconBackground: "bg-black",
    icon: XIcon,
    url: "https://x.com/blankparticle",
    shortLink: ["/x", "/twitter"],
  },
  {
    label: "Discord",
    iconBackground: "bg-[#5865F2]",
    icon: DiscordIcon,
    url: "https://discord.com/users/1096392763144159252",
    shortLink: [],
    modal: DiscordModal,
  },
  {
    label: "GitHub",
    iconBackground: "bg-[#1b1f23]",
    icon: GitHubIcon,
    url: "https://github.com/BlankParticle",
    shortLink: ["/gh", "/github"],
  },
  {
    label: "LinkedIn",
    iconBackground: "bg-[#0A66C2]",
    icon: LinkedInIcon,
    url: "https://www.linkedin.com/in/blankparticle",
    shortLink: ["/linkedin"],
  },
  {
    label: "Cal",
    url: "https://cal.com/blankparticle",
    shortLink: ["/cal"],
    showAsSticker: false,
  },
  {
    label: "Resume",
    url: "https://static.blankparticle.com/docs/resume.pdf",
    shortLink: ["/resume"],
    showAsSticker: false,
  },
];

export const personLd = {
  "@type": "Person",
  name: "Rahul Mishra",
  alternateName: "BlankParticle",
  url: SITE_URL,
  image: `${SITE_URL}/me.png`,
  jobTitle: "Software Developer",
  sameAs: socials.filter((social) => !["Email", "Cal", "Resume"].includes(social.label)).map((social) => social.url),
};

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

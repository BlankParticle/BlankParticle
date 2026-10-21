import { profiles } from "./site.ts";

/** How to reach me somewhere without a public profile: shown in a dialog on the home page and on its own page */
export interface Contact {
  page: "/email" | "/discord";
  title: string;
  description: string;
  value: string;
  /** shown under the label on the links page */
  subtext: string;
  copyLabel: string;
  actions: { label: string; href: string }[];
}

export const emailContact: Contact = {
  page: "/email",
  title: "Send me an email",
  description: "I will get back to you as soon as possible.",
  value: "hello@blankparticle.com",
  subtext: "hello@blankparticle.com",
  copyLabel: "Copy email",
  actions: [
    { label: "Open in Gmail", href: "https://mail.google.com/mail/?view=cm&fs=1&to=hello@blankparticle.com" },
    { label: "Open in Outlook", href: "https://outlook.live.com/mail/0/deeplink/compose?to=hello@blankparticle.com" },
  ],
};

export const discordContact: Contact = {
  page: "/discord",
  title: "Let's connect on Discord",
  description: "Add me as a friend with my username below.",
  value: "blankparticle",
  subtext: "@blankparticle",
  copyLabel: "Copy Discord username",
  actions: [{ label: "Open in Discord", href: profiles.discord }],
};

import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "#/components/contact-page.tsx";
import { discordContact } from "#/components/social-modals.tsx";
import { SITE_URL } from "#/lib/data.ts";

const pageTitle = "discord · blankparticle";
const pageUrl = `${SITE_URL}/discord`;

export const Route = createFileRoute("/discord")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: discordContact.description },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: discordContact.description },
      { property: "og:url", content: pageUrl },
      { property: "twitter:url", content: pageUrl },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: discordContact.description },
    ],
    links: [{ rel: "canonical", href: pageUrl }],
  }),
  component: () => <ContactPage contact={discordContact} />,
});

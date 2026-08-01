import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "@/components/contact-page.tsx";
import { emailContact } from "@/components/social-modals.tsx";
import { SITE_URL } from "@/lib/data.ts";

const pageTitle = "email · blankparticle";
const pageUrl = `${SITE_URL}/email`;

export const Route = createFileRoute("/email")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: emailContact.description },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: emailContact.description },
      { property: "og:url", content: pageUrl },
      { property: "twitter:url", content: pageUrl },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: emailContact.description },
    ],
    links: [{ rel: "canonical", href: pageUrl }],
  }),
  component: () => <ContactPage contact={emailContact} stamp="direct line · no spam" />,
});

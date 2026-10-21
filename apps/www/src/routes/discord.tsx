import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "#/components/contact-page.tsx";
import { discordContact } from "#/lib/contacts.ts";
import { seo } from "#/lib/site.ts";

export const Route = createFileRoute("/discord")({
  head: () => seo({ title: "discord · blankparticle", description: discordContact.description, path: "/discord" }),
  component: () => <ContactPage contact={discordContact} />,
});

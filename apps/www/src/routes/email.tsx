import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "#/components/contact-page.tsx";
import { emailContact } from "#/lib/contacts.ts";
import { seo } from "#/lib/site.ts";

export const Route = createFileRoute("/email")({
  head: () => seo({ title: "email · blankparticle", description: emailContact.description, path: "/email" }),
  component: () => <ContactPage contact={emailContact} />,
});

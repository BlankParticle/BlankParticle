import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "@/components/not-found.tsx";
import { socials } from "@/lib/data.ts";

const destinations = new Map(socials.flatMap(({ shortLink, url }) => shortLink.map((path) => [path.slice(1), url])));

function resolveShortLink(path?: string) {
  if (!path) return;

  const social = destinations.get(path);
  if (social) return social;

  const [provider, ...segments] = path.split("/");
  if ((provider === "gh" || provider === "github") && segments.length > 0)
    return `https://github.com/BlankParticle/${segments.at(-1)}`;
}

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: ({ params, next }) => {
        const destination = resolveShortLink(params._splat);
        return destination ? Response.redirect(destination, 301) : next();
      },
    },
  },
  component: NotFound,
});

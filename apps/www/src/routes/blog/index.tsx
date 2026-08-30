import { ArrowRightIcon } from "@blankparticle/ui/icons";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { SectionHeading } from "#/components/section-heading.tsx";
import { SiteLayout } from "#/components/site-layout.tsx";
import { postMeta } from "#/lib/blog-meta.ts";
import { personLd, SITE_URL } from "#/lib/data.ts";
import { formatPostDate } from "#/lib/utils.ts";

const blogListLoader = createServerFn().handler(() => postMeta);

const blogTitle = "blog · blankparticle";
const blogDescription = "Things I wrote down so I wouldn't have to figure them out twice.";
const blogUrl = `${SITE_URL}/blog`;

export const Route = createFileRoute("/blog/")({
  loader: () => blogListLoader(),
  head: () => ({
    meta: [
      { title: blogTitle },
      { name: "description", content: blogDescription },
      { property: "og:title", content: blogTitle },
      { property: "og:description", content: blogDescription },
      { property: "og:url", content: blogUrl },
      { property: "twitter:url", content: blogUrl },
      { name: "twitter:title", content: blogTitle },
      { name: "twitter:description", content: blogDescription },
    ],
    links: [{ rel: "canonical", href: blogUrl }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "blankparticle's blog",
          description: blogDescription,
          url: blogUrl,
          author: personLd,
        }),
      },
    ],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const posts = Route.useLoaderData();

  const byYear = new Map<string, typeof posts>();
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), post]);
  }

  return (
    <SiteLayout back={{ to: "/", label: "blankparticle.com" }}>
      <section className="flex flex-col gap-4">
        <p className="reveal eyebrow text-orange-deep">Writing</p>
        <h1 className="reveal reveal-90 text-display text-primary font-extrabold">The Blog</h1>
        <p className="reveal reveal-180 text-muted-foreground max-w-xl">{blogDescription}</p>
      </section>

      {[...byYear.entries()].map(([year, yearPosts], sectionIndex) => (
        <section key={year} className="reveal flex flex-col" style={{ animationDelay: `${270 + sectionIndex * 90}ms` }}>
          <SectionHeading>{year}</SectionHeading>
          <ol className="rule-dots flex flex-col border-t-2">
            {yearPosts.map((post, i) => (
              <li key={post.slug} className="rule-dots border-b-2">
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="group list-row flex items-baseline gap-4 py-5 sm:gap-6"
                >
                  <span className="font-heading text-orange-deep text-xl font-bold tabular-nums" aria-hidden="true">
                    {String(yearPosts.length - i).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-heading text-violet-deep group-hover:text-primary text-xl font-bold wrap-break-word transition-colors">
                      {post.title}
                    </span>
                    <span className="text-muted-foreground text-sm">{post.description}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <time dateTime={post.date} className="font-heading text-orange-deep mr-1.5 text-sm font-bold">
                        {formatPostDate(post.date)}
                      </time>
                      {post.tags.map((tag, tagIndex) => (
                        <Badge key={tag} variant={tagIndex % 2 === 0 ? "default" : "accent"}>
                          #{tag}
                        </Badge>
                      ))}
                    </span>
                  </span>
                  <ArrowRightIcon
                    weight="bold"
                    className="text-orange-deep ml-auto size-5 shrink-0 self-center transition-transform duration-200 ease-out group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </SiteLayout>
  );
}

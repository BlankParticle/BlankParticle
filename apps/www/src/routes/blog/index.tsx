import { createFileRoute, Link } from "@tanstack/react-router";

import { LiveTime } from "@/components/live-time.tsx";
import { ALL_BLOG_POSTS } from "@/lib/blog-content.ts";
import { personLd } from "@/lib/data.ts";
import { formatPostDate } from "@/lib/utils.ts";

export const Route = createFileRoute("/blog/")({
  loader: () => [...ALL_BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1)),
  head: () => ({
    meta: [
      { title: "blog · blankparticle" },
      {
        name: "description",
        content: "Things I wrote down so I wouldn't have to figure them out twice.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "blankparticle's blog",
          description: "Things I wrote down so I wouldn't have to figure them out twice.",
          url: "https://blankparticle.com/blog",
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
    <main className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
      <header className="animate-reveal border-violet/35 text-violet flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed py-4 text-xs font-bold tracking-[0.18em] uppercase motion-reduce:animate-none">
        <Link to="/" className="hover:text-orange-deep transition-colors">
          ← blankparticle.com
        </Link>
        <span className="text-orange-deep hidden sm:inline">the archive · printed once</span>
        <span>
          my time: <LiveTime /> ist
        </span>
      </header>

      <section className="flex flex-col gap-5 py-12 sm:py-16">
        <h1 className="animate-reveal font-display text-violet text-[clamp(3rem,8vw,5.5rem)] leading-[0.95] font-extrabold tracking-tight [animation-delay:90ms] motion-reduce:animate-none">
          The Blog
        </h1>
        <p className="animate-reveal text-ink-muted max-w-xl text-base [animation-delay:180ms] motion-reduce:animate-none">
          Things I wrote down so I wouldn't have to figure them out twice.
        </p>
      </section>

      {[...byYear.entries()].map(([year, yearPosts], sectionIndex) => (
        <section
          key={year}
          className="animate-reveal flex flex-col gap-2 pb-12 motion-reduce:animate-none sm:pb-16"
          style={{ animationDelay: `${270 + sectionIndex * 90}ms` }}
        >
          <div className="flex items-baseline justify-between gap-4 pb-4">
            <h2 className="font-display text-violet text-3xl font-extrabold tracking-tight sm:text-4xl">{year}</h2>
            <span className="text-orange-deep text-xs font-bold tracking-[0.18em] uppercase">
              {yearPosts.length} {yearPosts.length === 1 ? "issue" : "issues"}
            </span>
          </div>
          <ol className="flex flex-col">
            {yearPosts.map((post, i) => (
              <li key={post.slug} className="border-violet/35 border-t-2 border-dashed last:border-b-2">
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="group flex items-baseline gap-4 py-5 sm:gap-6"
                >
                  <span className="font-display text-orange-deep text-xl font-bold tabular-nums" aria-hidden="true">
                    {String(yearPosts.length - i).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-display text-violet-deep group-hover:decoration-orange text-xl font-bold wrap-break-word underline decoration-transparent decoration-2 underline-offset-4 transition-colors duration-200">
                      {post.title}
                    </span>
                    <span className="text-ink-muted text-sm">{post.description}</span>
                    <span className="text-orange-deep pt-1 text-xs font-bold tracking-[0.18em] uppercase">
                      {formatPostDate(post.date)} · {post.tags.join(" · ")}
                    </span>
                  </span>
                  <span
                    className="text-orange-deep ml-auto shrink-0 text-lg font-bold transition-transform duration-200 ease-out group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <footer className="animate-reveal border-violet/35 flex justify-center border-t-2 border-dashed pt-6 text-center text-xs font-bold [animation-delay:450ms] motion-reduce:animate-none">
        <span className="border-orange-deep text-orange-deep -rotate-2 rounded border-2 border-dashed px-2 py-1 tracking-[0.18em] uppercase">
          end of the archive
        </span>
      </footer>
    </main>
  );
}

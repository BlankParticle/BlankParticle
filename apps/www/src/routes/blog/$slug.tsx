import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { LiveTime } from "@/components/live-time.tsx";
import { ALL_BLOG_POSTS } from "@/lib/blog-content.ts";
import { personLd } from "@/lib/data.ts";
import { formatPostDate } from "@/lib/utils.ts";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = ALL_BLOG_POSTS.find((post) => post.slug === params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData: post }) => ({
    meta: post
      ? [
          { title: `${post.title} · blankparticle` },
          { name: "description", content: post.description },
          { property: "og:title", content: post.title },
          { property: "og:description", content: post.description },
          { property: "og:type", content: "article" },
          ...(post.cover
            ? [
                {
                  property: "og:image",
                  content: post.cover,
                },
                {
                  name: "twitter:image",
                  content: post.cover,
                },
              ]
            : []),
          { name: "twitter:title", content: post.title },
          { name: "twitter:description", content: post.description },
        ]
      : [],
    scripts: post
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              url: `https://blankparticle.com/blog/${post.slug}`,
              mainEntityOfPage: `https://blankparticle.com/blog/${post.slug}`,
              keywords: post.tags.join(", "),
              ...(post.cover ? { image: post.cover } : {}),
              author: personLd,
              publisher: personLd,
            }),
          },
        ]
      : [],
  }),
  component: BlogPostPage,
});

function BlogPostPage() {
  const post = Route.useLoaderData();

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
      <header className="animate-reveal border-violet/35 text-violet flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed py-4 text-xs font-bold tracking-[0.18em] uppercase motion-reduce:animate-none">
        <Link to="/blog" className="hover:text-orange-deep transition-colors">
          ← the blog
        </Link>
        <span>
          my time: <LiveTime /> ist
        </span>
      </header>

      <article className="py-10 sm:py-14">
        <div className="flex flex-col gap-4 pb-4">
          <span className="animate-reveal text-orange-deep text-xs font-bold tracking-[0.18em] uppercase motion-reduce:animate-none">
            {formatPostDate(post.date)} · {post.tags.join(" · ")}
          </span>
          <h1 className="animate-reveal font-display text-violet text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.05] font-extrabold tracking-tight [animation-delay:90ms] motion-reduce:animate-none">
            {post.title}
          </h1>
        </div>
        {post.cover && (
          <img
            src={post.cover}
            alt=""
            className="animate-reveal border-ink mt-6 w-full rotate-[0.5deg] rounded-2xl border-2 shadow-[4px_4px_0_var(--color-violet)] [animation-delay:180ms] motion-reduce:animate-none"
          />
        )}
        <div
          className="typeset animate-reveal pt-4 [animation-delay:270ms] motion-reduce:animate-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      <footer className="animate-reveal border-violet/35 flex flex-col items-center gap-4 border-t-2 border-dashed pt-6 text-center text-xs font-bold motion-reduce:animate-none">
        <span className="border-orange-deep text-orange-deep -rotate-2 rounded border-2 border-dashed px-2 py-1 tracking-[0.18em] uppercase">
          thanks for reading
        </span>
        <Link to="/blog" className="text-violet hover:text-orange-deep tracking-[0.18em] uppercase transition-colors">
          ← back to the archive
        </Link>
      </footer>
    </main>
  );
}

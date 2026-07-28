import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { renderServerComponent } from "@tanstack/react-start/rsc";

import { LiveTime } from "@/components/live-time.tsx";
import { blogSource } from "@/lib/blog-content.ts";
import { personLd, SITE_URL } from "@/lib/data.ts";
import { formatPostDate } from "@/lib/utils.ts";

const blogPageLoader = createServerFn()
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const post = blogSource.getPage([data.slug]);
    if (!post) throw notFound();
    const content = await renderServerComponent(<post.data.body />);
    return {
      post: {
        slug: post.slugs[0],
        title: post.data.title,
        description: post.data.description,
        date: post.data.date,
        tags: post.data.tags,
        cover: post.data.cover,
      },
      content,
    };
  });

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => blogPageLoader({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { post } = loaderData;
    const postUrl = `${SITE_URL}/blog/${post.slug}`;
    const coverUrl = post.cover && new URL(post.cover, SITE_URL).href;
    return {
      meta: [
        { title: `${post.title} · blankparticle` },
        { name: "description", content: post.description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: postUrl },
        { property: "twitter:url", content: postUrl },
        { property: "article:published_time", content: post.date },
        ...(coverUrl
          ? [
              { property: "og:image", content: coverUrl },
              { name: "twitter:image", content: coverUrl },
            ]
          : []),
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.description },
      ],
      links: [{ rel: "canonical", href: postUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            url: postUrl,
            mainEntityOfPage: postUrl,
            keywords: post.tags.join(", "),
            ...(coverUrl ? { image: coverUrl } : {}),
            author: personLd,
            publisher: personLd,
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post, content } = Route.useLoaderData();

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
        <div className="border-violet/30 relative flex flex-col gap-5 border-b-2 border-dashed pb-8 sm:pb-10">
          <div className="animate-reveal flex flex-wrap items-center gap-2 motion-reduce:animate-none">
            <time
              dateTime={post.date}
              className="border-orange-deep text-orange-deep -rotate-1 rounded-md border-2 border-dashed px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.16em] uppercase"
            >
              {formatPostDate(post.date)}
            </time>
            <span className="text-ink-muted/60 text-[0.65rem] font-bold tracking-[0.18em] uppercase">field notes</span>
          </div>
          <h1 className="animate-reveal font-display text-violet text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.05] font-extrabold tracking-tight [animation-delay:90ms] motion-reduce:animate-none">
            {post.title}
          </h1>
          <p className="animate-reveal text-ink-muted max-w-2xl text-lg leading-relaxed [animation-delay:140ms] motion-reduce:animate-none">
            {post.description}
          </p>
          <div
            className="animate-reveal flex flex-wrap gap-2 [animation-delay:180ms] motion-reduce:animate-none"
            aria-label="Post tags"
          >
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="border-violet/50 bg-lime/30 text-violet-deep rounded-full border-2 px-3 py-1 text-xs font-bold tracking-wide odd:rotate-1 even:-rotate-1"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        {post.cover && (
          <img
            src={post.cover}
            alt={post.title}
            className="animate-reveal border-ink mt-8 aspect-40/21 w-full rotate-[0.5deg] rounded-2xl border-2 object-cover shadow-[4px_4px_0_var(--color-violet)] [animation-delay:230ms] motion-reduce:animate-none"
          />
        )}
        <div className="typeset animate-reveal pt-6 [animation-delay:300ms] motion-reduce:animate-none">{content}</div>
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

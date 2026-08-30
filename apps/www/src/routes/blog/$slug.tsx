import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { renderToStaticMarkup } from "react-dom/server";

import { SiteLayout } from "@/components/site-layout.tsx";
import { blogSource } from "@/lib/blog-content.ts";
import { personLd, SITE_URL } from "@/lib/data.ts";
import { formatPostDate } from "@/lib/utils.ts";

const blogPageLoader = createServerFn()
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const post = blogSource.getPage([data.slug]);
    if (!post) throw notFound();
    const { body: Body } = await post.data.load();
    // Posts are static (native <details> is the only interactivity), so render the compiled MDX to
    // an HTML string here and inject it — no RSC runtime, no per-post client hydration.
    return {
      post: {
        slug: post.slugs[0],
        title: post.data.title,
        description: post.data.description,
        date: post.data.date,
        tags: post.data.tags,
        cover: post.data.cover,
      },
      html: renderToStaticMarkup(<Body />),
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
  const { post, html } = Route.useLoaderData();

  return (
    <SiteLayout back={{ to: "/blog", label: "the blog" }}>
      <article>
        <div className="rule-dots flex flex-col gap-5 border-b-2 pb-8 sm:pb-10">
          <div className="reveal flex flex-wrap items-center gap-x-3 gap-y-1">
            <time dateTime={post.date} className="font-heading text-orange-deep text-sm font-bold">
              {formatPostDate(post.date)}
            </time>
          </div>
          <h1 className="reveal reveal-90 text-title text-primary font-extrabold">{post.title}</h1>
          <p className="reveal reveal-180 text-muted-foreground max-w-2xl text-lg leading-relaxed">
            {post.description}
          </p>
          <div className="reveal reveal-180 flex flex-wrap gap-1.5" aria-label="Post tags">
            {post.tags.map((tag, tagIndex) => (
              <Badge key={tag} variant={tagIndex % 2 === 0 ? "default" : "accent"}>
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
        {post.cover && (
          <img
            src={post.cover}
            alt={post.title}
            className="reveal reveal-270 sticker sticker-lg sticker-primary mt-8 aspect-40/21 w-full rounded-xl object-cover"
          />
        )}
        <div className="typeset reveal reveal-360 pt-6" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </SiteLayout>
  );
}

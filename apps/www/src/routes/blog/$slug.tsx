import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { blogSource } from "#/lib/blog-content.ts";
import { personLd, seo, SITE_URL } from "#/lib/site.ts";
import { formatPostDate } from "#/lib/utils.ts";

/** Post images sit below the fold, so they load lazily and decode off the main thread */
const mdxComponents = {
  img: (props: ComponentProps<"img">) => <img loading="lazy" decoding="async" {...props} />,
};

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
      html: renderToStaticMarkup(<Body components={mdxComponents} />),
    };
  });

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => blogPageLoader({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { post } = loaderData;
    const postUrl = `${SITE_URL}/blog/${post.slug}`;
    const coverUrl = post.cover && new URL(post.cover, SITE_URL).href;
    const { meta, links } = seo({
      title: `${post.title} · blankparticle`,
      description: post.description,
      path: `/blog/${post.slug}`,
      type: "article",
      // posts without a cover share the site's card
      ...(coverUrl ? { image: { url: coverUrl, alt: post.title } } : {}),
    });
    return {
      meta: [...meta, { property: "article:published_time", content: post.date }],
      links,
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
    <>
      {/* code-block token colours; React hoists this into the head once, and only posts need it */}
      <style href="highlight-theme" precedence="default">
        {import.meta.env.HIGHLIGHT_THEME_CSS}
      </style>
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
    </>
  );
}

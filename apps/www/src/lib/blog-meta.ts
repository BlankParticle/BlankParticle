import type { PostFrontmatter } from "./post-schema.ts";

/**
 * Every post's frontmatter, newest first, without the compiled bodies. This is what the SSR worker
 * needs (lists, rss, sitemap); `blog-content.ts` — the full collection with `load()` — is only
 * touched by the server functions that render a post, which run in the RSC environment.
 * Frontmatter is validated against `PostFrontmatter` by fumadocs at build time, so the cast is safe.
 */
const heads = import.meta.glob("../content/blog/*.mdx", {
  query: "?collection=posts&only=frontmatter",
  import: "frontmatter",
  eager: true,
}) as Record<string, PostFrontmatter>;

export const postMeta = Object.entries(heads)
  .map(([path, frontmatter]) => ({
    slug: path
      .split("/")
      .pop()!
      .replace(/\.mdx?$/, ""),
    ...frontmatter,
  }))
  .sort((a, b) => b.date.localeCompare(a.date));

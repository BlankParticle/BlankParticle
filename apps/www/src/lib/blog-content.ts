import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import langBash from "shiki/langs/bash.mjs";
import langCss from "shiki/langs/css.mjs";
import langJson from "shiki/langs/json.mjs";
import langTypescript from "shiki/langs/typescript.mjs";
import themeCatppuccinLatte from "shiki/themes/catppuccin-latte.mjs";
import { unified } from "unified";

import { resolveBlogImage } from "./blog-images.ts";

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  cover?: string;
}

export interface BlogPost extends BlogPostMeta {
  html: string;
}

const rawPosts = import.meta.glob("../content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseFrontmatter(slug: string, raw: string) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!match) throw new Error(`Missing frontmatter in blog post "${slug}"`);
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  const meta: BlogPostMeta = {
    slug,
    title: fields.title ?? slug,
    description: fields.description ?? "",
    date: fields.date ?? "1970-01-01",
    tags: fields.tags ? fields.tags.split(",").map((tag) => tag.trim()) : [],
    // cover keeps its ./images/... path; routes resolve it with resolveBlogImage
    // so the client bundle also references the assets and emits them to dist/client
    ...(fields.cover ? { cover: fields.cover } : {}),
  };
  const body = raw.slice(match[0].length).replace(/\.\/images\/[\w.-]+/g, resolveBlogImage);
  return { meta, body };
}

const posts = new Map(
  Object.entries(rawPosts)
    .map(([path, raw]) => {
      const slug = path.split("/").pop()!.replace(/\.md$/, "");
      return parseFrontmatter(slug, raw);
    })
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date))
    .map((post) => [post.meta.slug, post]),
);

const processor = createHighlighterCore({
  themes: [themeCatppuccinLatte],
  langs: [langTypescript, langBash, langJson, langCss],
  engine: createJavaScriptRegexEngine(),
}).then((highlighter) =>
  unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeShikiFromHighlighter, highlighter, {
      theme: "catppuccin-latte",
      fallbackLanguage: "typescript",
    })
    .use(rehypeStringify),
);

const rendered = new Map<string, string>();

export function getPostList(): BlogPostMeta[] {
  return [...posts.values()].map((post) => post.meta);
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const post = posts.get(slug);
  if (!post) return null;
  let html = rendered.get(slug);
  if (html === undefined) {
    html = String(await (await processor).process(post.body));
    rendered.set(slug, html);
  }
  return { ...post.meta, html };
}

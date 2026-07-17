import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import rehypeShiki from "@shikijs/rehype";
import rehypeAutoLinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import * as v from "valibot";

const posts = defineCollection({
  name: "posts",
  directory: "src/content/blog",
  include: "*.md",
  schema: v.object({
    content: v.string(),
    title: v.string(),
    description: v.string(),
    date: v.pipe(v.string(), v.isoDate()),
    tags: v.array(v.string()),
    cover: v.optional(v.string()),
  }),
  transform: async (document, context) => {
    const content = await compileMarkdown(context, document, {
      allowDangerousHtml: true,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeRaw,
        rehypeSlug,
        [rehypeAutoLinkHeadings, { behavior: "wrap", properties: { className: ["anchor"] } }],
        [rehypeShiki, { theme: "catppuccin-latte", fallbackLanguage: "typescript" }],
      ],
    });
    return { ...document, slug: document._meta.path, content };
  },
});

export default defineConfig({ content: [posts] });

import { remarkGfm } from "fumadocs-core/mdx-plugins/remark-gfm";
import { applyMdxPreset, defineDocs } from "fumadocs-mdx/config";
import autoLinkHeadings from "rehype-autolink-headings";
import * as v from "valibot";

export const posts = defineDocs({
  dir: "src/content/blog",
  docs: {
    schema: v.object({
      title: v.string(),
      description: v.string(),
      date: v.pipe(v.string(), v.isoDate()),
      tags: v.array(v.string()),
      cover: v.optional(v.string()),
    }),
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkGfm],
      remarkImageOptions: { useImport: false },
      rehypeCodeOptions: {
        themes: { light: "github-light", dark: "github-dark" },
        langs: ["typescript", "bash", "json", "tsx", "jsx", "diff"],
        fallbackLanguage: "typescript",
      },
      rehypePlugins: [[autoLinkHeadings, { behavior: "wrap" }]],
    }),
  },
});

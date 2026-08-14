import { join } from "node:path";

import * as Schema from "effect/Schema";
import { remarkGfm } from "fumadocs-core/mdx-plugins/remark-gfm";
import { applyMdxPreset, defineDocs } from "fumadocs-mdx/config";
import autoLinkHeadings from "rehype-autolink-headings";
import externalLinks from "rehype-external-links";

export const posts = defineDocs({
  dir: join(import.meta.dirname, "src/content/blog"),
  docs: {
    schema: Schema.toStandardSchemaV1(
      Schema.Struct({
        title: Schema.String,
        description: Schema.String,
        date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
        tags: Schema.Array(Schema.String),
        cover: Schema.optional(Schema.String),
      }),
    ),
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkGfm],
      remarkImageOptions: { useImport: false },
      rehypeCodeOptions: {
        themes: { light: "github-light", dark: "github-dark" },
        langs: ["typescript", "bash", "json", "tsx", "jsx", "diff"],
        fallbackLanguage: "typescript",
      },
      rehypePlugins: [
        [autoLinkHeadings, { behavior: "wrap" }],
        [externalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }],
      ],
    }),
  },
});

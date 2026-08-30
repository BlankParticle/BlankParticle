import { join } from "node:path";

import { createHighlighter } from "@tanstack/highlight/core";
import { css } from "@tanstack/highlight/languages/css";
import { diff } from "@tanstack/highlight/languages/diff";
import { js } from "@tanstack/highlight/languages/js";
import { json } from "@tanstack/highlight/languages/json";
import { jsx } from "@tanstack/highlight/languages/jsx";
import { shell } from "@tanstack/highlight/languages/shell";
import { ts } from "@tanstack/highlight/languages/ts";
import { tsx } from "@tanstack/highlight/languages/tsx";
import { remarkHighlightCodeBlocks } from "@tanstack/highlight/remark";
import * as Schema from "effect/Schema";
import { remarkGfm } from "fumadocs-core/mdx-plugins/remark-gfm";
import { applyMdxPreset, defineDocs } from "fumadocs-mdx/config";
import autoLinkHeadings from "rehype-autolink-headings";
import externalLinks from "rehype-external-links";

import { PostFrontmatter } from "./src/lib/post-schema.ts";

/**
 * Code blocks are highlighted at build time into semantic `th-*` classes (coloured in app.css),
 * instead of shiki's per-token inline light/dark styles that made every post several hundred KB.
 */
const highlighter = createHighlighter({
  languages: [ts, tsx, js, jsx, json, shell, css, diff],
  fallbackLanguage: "ts",
});

export const posts = defineDocs({
  dir: join(import.meta.dirname, "src/content/blog"),
  docs: {
    // frontmatter is bundled eagerly (lists, rss, sitemap); bodies are separate chunks loaded with `load()` where they render
    async: true,
    schema: Schema.toStandardSchemaV1(PostFrontmatter),
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkGfm, () => remarkHighlightCodeBlocks({ highlighter })],
      remarkImageOptions: { useImport: false },
      rehypeCodeOptions: false,
      rehypePlugins: [
        [autoLinkHeadings, { behavior: "wrap" }],
        [externalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }],
      ],
    }),
  },
});

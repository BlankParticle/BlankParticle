import { createHighlighter, renderNodesToHtml, renderTokens } from "@tanstack/highlight/core";
import { css } from "@tanstack/highlight/languages/css";
import { diff } from "@tanstack/highlight/languages/diff";
import { html as htmlLang } from "@tanstack/highlight/languages/html";
import { js } from "@tanstack/highlight/languages/js";
import { json } from "@tanstack/highlight/languages/json";
import { jsx } from "@tanstack/highlight/languages/jsx";
import { markdown } from "@tanstack/highlight/languages/markdown";
import { python } from "@tanstack/highlight/languages/python";
import { shell } from "@tanstack/highlight/languages/shell";
import { sql } from "@tanstack/highlight/languages/sql";
import { ts } from "@tanstack/highlight/languages/ts";
import { tsx } from "@tanstack/highlight/languages/tsx";
import { yaml } from "@tanstack/highlight/languages/yaml";
import { createThemeRule, themeTokenClasses } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import { renderHtml } from "@tanstack/markdown/html";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

const titleOf = (source: string, fallback: string) => {
  const heading = source.match(/^#\s+(.+?)\s*#*\s*$/m);
  return heading?.[1] ?? fallback;
};

// One highlighter instance reused across renders; the same GitHub theme as the blog.
const highlighter = createHighlighter({
  languages: [ts, tsx, js, jsx, json, shell, css, htmlLang, yaml, sql, python, diff, markdown],
  fallbackLanguage: "plaintext",
});

// @tanstack/markdown wraps our return in its own <pre><code>, so emit only the inner token markup
// (not TanStack Highlight's full <pre>) to avoid a nested code block.
const highlight = (code: string, lang?: string): string => {
  const { tokens } = highlighter.highlight(code, lang ? { lang } : {});
  return renderNodesToHtml(renderTokens(tokens));
};

/**
 * GitHub light/dark token colours. These pages have no theme toggle, so dark follows the OS via
 * `prefers-color-scheme` (not a `.dark` class). We emit the variable sets and the token→variable
 * rules ourselves so the code background can reuse the theme's own `--th-background`.
 */
const HIGHLIGHT_CSS = [
  createThemeRule(":root", githubLightTheme),
  `@media(prefers-color-scheme:dark){${createThemeRule(":root", githubDarkTheme)}}`,
  themeTokenClasses.map((token) => `.th-${token}{color:var(--th-${token})}`).join(""),
].join("\n");

/**
 * Self-contained page styles for a rendered markdown site, matching the design system:
 * Plus Jakarta Sans display, Figtree body, JetBrains Mono code, the violet/orange inks, and a
 * dotted underline that fills orange on hover. Follows the OS colour scheme.
 */
const STYLE = `
:root{
  color-scheme:light dark;
  --paper:oklch(98.4% .005 85);--ink:oklch(23% .025 290);--ink-muted:oklch(44% .025 290);
  --violet:oklch(46% .17 295);--violet-deep:oklch(38% .15 295);--orange:oklch(68% .17 45);--orange-deep:oklch(52% .16 40);
  --highlight:oklch(92% .12 118);--card:oklch(99.6% .002 85);--rule:color-mix(in oklch,var(--ink) 12%,transparent);--radius:.5rem;
}
@media(prefers-color-scheme:dark){:root{
  --paper:oklch(17% .014 290);--ink:oklch(93% .008 85);--ink-muted:oklch(67% .015 290);
  --violet:oklch(74% .13 295);--violet-deep:oklch(82% .1 295);--orange:oklch(74% .15 50);--orange-deep:oklch(70% .16 45);
  --highlight:oklch(42% .09 118);--card:oklch(20.5% .015 290);
}}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink);font:16px/1.7 "Figtree Variable","Figtree","Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%;scroll-behavior:smooth;font-optical-sizing:auto}
body{margin:0;padding:3rem 1.25rem 5rem}
main{max-width:46rem;margin:0 auto}
.typeset{--flow:1.2em;overflow-wrap:break-word}
.typeset :where(p,ul,ol,pre,blockquote,table,figure,.footnotes){margin-block:var(--flow) 0}
.typeset :where(h1,h2,h3,h4,h5,h6){font-family:"Plus Jakarta Sans Variable","Plus Jakarta Sans","Helvetica Neue",Arial,sans-serif;font-weight:800;line-height:1.2;letter-spacing:-.015em;margin-block:var(--flow) 0;text-wrap:balance;scroll-margin-block-start:var(--flow)}
.typeset h1{color:var(--violet);font-size:2.25em;line-height:1.1}
.typeset h2{font-size:1.5em;margin-block-start:calc(var(--flow)*1.5)}
.typeset h3{font-size:1.25em}.typeset h4{font-size:1.05em;font-weight:700}
.typeset h5{font-size:.9em;font-weight:700;color:var(--ink-muted)}
.typeset h6{font-size:.75em;font-weight:800;color:var(--orange-deep);letter-spacing:.14em;text-transform:uppercase}
.typeset :where(h1,h2,h3,h4,h5,h6)+*{margin-block-start:1em}
.typeset a{color:var(--violet);font-weight:600;text-decoration:none;padding-bottom:2px;
  background-image:linear-gradient(var(--orange),var(--orange)),radial-gradient(circle,color-mix(in oklch,var(--orange) 75%,transparent) 1px,transparent 1.3px);
  background-size:0 2px,5px 4px;background-position:100% 100%,0 calc(100% + 1px);background-repeat:no-repeat,repeat-x;
  transition:background-size .28s cubic-bezier(.16,1,.3,1)}
.typeset a:hover,.typeset a:focus-visible{background-position:0 100%,0 calc(100% + 1px);background-size:100% 2px,5px 4px}
.typeset a:focus-visible{outline:2px solid var(--violet);outline-offset:2px;border-radius:.125em}
.typeset :where(strong,b){font-weight:700}.typeset :where(del,s){color:var(--ink-muted)}
.typeset mark{background:color-mix(in oklch,var(--highlight) 80%,transparent);color:inherit;padding:.05em .2em;border-radius:.2em}
.typeset :where(ul,ol){padding-inline-start:1.5em}.typeset li{margin-block-start:.5em;padding-inline-start:.4em}.typeset :where(li>p,li>ul,li>ol){margin-block-start:.5em}.typeset li::marker{color:var(--orange-deep)}
.typeset ul.contains-task-list{list-style:none;padding-inline-start:.25em}.typeset li.task-list-item>input{margin-inline-end:.5em;vertical-align:-.1em;accent-color:var(--violet)}
.typeset :where(code,pre,kbd){font-family:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.typeset :not(pre)>code{background:color-mix(in oklch,var(--ink) 6%,transparent);border:1px solid var(--rule);font-size:.85em;border-radius:.35em;padding:.1em .35em;white-space:nowrap}
.typeset pre{background:var(--th-background,var(--card));border:1px solid var(--rule);color:var(--th-token,var(--ink));font-size:.875em;line-height:1.6;tab-size:2;border-radius:var(--radius);padding:.9em 1.1em;overflow-x:auto}
.typeset pre code{background:transparent;border:0;font:inherit;padding:0;white-space:pre}
.typeset blockquote{border-inline-start:2px dotted color-mix(in oklch,var(--violet) 40%,transparent);color:var(--ink-muted);padding-inline-start:1em;margin-inline:0}
.typeset hr{border:0;border-block-start:2px dotted color-mix(in oklch,var(--violet) 35%,transparent);margin-block:calc(var(--flow)*2.4) 0}
.typeset :where(img,video){display:block;max-width:100%;height:auto;margin-inline:auto;border-radius:var(--radius);box-shadow:0 0 0 1px var(--rule)}
.typeset table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;font-variant-numeric:tabular-nums}
.typeset :where(th,td){border-bottom:1px solid var(--rule);padding:.6em 1em;text-align:start;vertical-align:top}
.typeset th{font-weight:700;white-space:nowrap;color:var(--ink)}
.typeset thead{background:color-mix(in oklch,var(--violet) 8%,transparent)}
.typeset kbd{border:1px solid var(--rule);border-block-end-width:2px;border-radius:.35em;font-size:.85em;padding:.05em .4em}
.typeset .footnotes{border-block-start:2px dotted color-mix(in oklch,var(--violet) 35%,transparent);padding-block-start:var(--flow);font-size:.875em;color:var(--ink-muted)}
.typeset>:first-child,.typeset :where(li,blockquote,td,th,figure)>:first-child{margin-block-start:0}
::selection{background:color-mix(in oklch,var(--orange) 35%,transparent)}
.typeset pre .th-comment{font-style:italic}
@media(max-width:46rem){.typeset{font-size:1.0625rem}.typeset h1{font-size:1.9em}}
@media print{body{padding:0}.typeset :where(pre,table,blockquote,figure){break-inside:avoid}.typeset :where(h1,h2,h3,h4){break-after:avoid}}
${HIGHLIGHT_CSS}
`;

const FONTS =
  "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&family=Plus+Jakarta+Sans:wght@400..800&family=JetBrains+Mono:wght@400..700&display=swap";

export const renderMarkdown = (path: string, source: string): string => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const body = renderHtml(source, {
    allowHtml: true,
    frontmatter: true,
    headingAnchors: false,
    highlighter: highlight,
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titleOf(source, name))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${STYLE}</style>
</head>
<body>
<main class="typeset">
${body}
</main>
</body>
</html>
`;
};

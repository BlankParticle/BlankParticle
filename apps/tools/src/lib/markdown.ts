import { renderHtml } from "@tanstack/markdown/html";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

const titleOf = (source: string, fallback: string) => {
  const heading = source.match(/^#\s+(.+?)\s*#*\s*$/m);
  return heading?.[1] ?? fallback;
};

const STYLE = `
:root{color-scheme:light;--paper:oklch(98% .005 110);--ink:oklch(27% .03 300);--ink-muted:oklch(46% .03 300);--violet:oklch(37% .17 300);--orange:oklch(68% .19 45);--lime:oklch(92% .16 125);--surface:oklch(94% .01 110);--rule:color-mix(in oklch,var(--ink) 15%,transparent);--radius:.5rem}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink);font:16px/1.75 Karla,"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;padding:2.5rem 1.25rem 4rem}
main{max-width:48rem;margin:0 auto}
.typeset{--flow:1.25em;overflow-wrap:break-word}
.typeset :where(p,ul,ol,pre,blockquote,table,figure,.footnotes){margin-block:var(--flow) 0}
.typeset :where(h1,h2,h3,h4,h5,h6){color:var(--ink);font-family:"Bricolage Grotesque","Arial Black",sans-serif;font-weight:800;line-height:1.3;margin-block:var(--flow) 0;scroll-margin-block-start:var(--flow)}
.typeset h1{font-size:2.25em;line-height:1.15}.typeset h2{font-size:1.5em;margin-block-start:calc(var(--flow)*1.4)}.typeset h3{font-size:1.25em}.typeset h4{font-size:1em}.typeset h5{font-size:.875em;color:var(--ink-muted)}.typeset h6{font-size:.8125em;color:var(--ink-muted);letter-spacing:.08em;text-transform:uppercase}
.typeset :where(h1,h2,h3,h4,h5,h6)+*{margin-block-start:1em}
.typeset a{color:var(--violet);font-weight:700;text-decoration:underline wavy var(--orange) 2px;text-underline-offset:4px;text-decoration-skip-ink:none}
.typeset a:focus-visible{outline:2px solid var(--violet);outline-offset:2px;border-radius:.125em}
.typeset :where(strong,b){font-weight:700}.typeset :where(del,s){color:var(--ink-muted)}
.typeset :where(ul,ol){padding-inline-start:1.5em}.typeset li{margin-block-start:.5em;padding-inline-start:.4em}.typeset :where(li>p,li>ul,li>ol){margin-block-start:.5em}.typeset li::marker{color:var(--ink-muted)}
.typeset ul.contains-task-list{list-style:none;padding-inline-start:.25em}.typeset li.task-list-item>input{margin-inline-end:.5em;vertical-align:-.1em;accent-color:var(--violet)}
.typeset :where(code,pre){font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.typeset :not(pre)>code{background:var(--surface);font-size:.85em;border-radius:.3em;padding:.125em .3em}
.typeset pre{background:var(--surface);border:1px solid var(--rule);font-size:.875em;line-height:1.5;tab-size:2;border-radius:var(--radius);padding:.75em 1em;overflow-x:auto}.typeset pre code{background:transparent;font:inherit;padding:0}
.typeset blockquote{border-inline-start:2px solid var(--orange);color:var(--ink-muted);padding-inline-start:1em;margin-inline:0}
.typeset hr{border:0;border-block-start:1px solid var(--rule);margin-block:calc(var(--flow)*2.4) 0}
.typeset :where(img,video){display:block;max-width:100%;height:auto;margin-inline:auto;border:2px solid color-mix(in oklch,var(--ink) 60%,transparent);border-radius:calc(var(--radius)*1.4)}
.typeset table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;font-variant-numeric:tabular-nums}.typeset :where(th,td){border-bottom:1px solid var(--rule);padding:.65em 1em;text-align:start;vertical-align:top}.typeset th{font-weight:700;white-space:nowrap;background:color-mix(in oklch,var(--lime) 30%,transparent)}
.typeset .footnotes{border-block-start:1px solid var(--rule);padding-block-start:var(--flow);font-size:.875em;color:var(--ink-muted)}
.typeset>:first-child,.typeset :where(li,blockquote,td,th,figure)>:first-child{margin-block-start:0}
::selection{background:var(--orange);color:var(--paper)}
@media(max-width:48rem){.typeset{font-size:1.125rem}.typeset h1{font-size:1.75em}}
@media print{body{padding:0}.typeset :where(pre,table,blockquote,figure){break-inside:avoid}.typeset :where(h1,h2,h3,h4){break-after:avoid}}
`;

export const renderMarkdown = (path: string, source: string): string => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const body = renderHtml(source, { allowHtml: true, frontmatter: true, headingAnchors: false });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titleOf(source, name))}</title>
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

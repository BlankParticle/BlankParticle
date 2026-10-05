/**
 * The design system's tokens for the self-contained HTML documents served outside the React app
 * (rendered markdown sites, 404s, folder listings). Mirrors `@blankparticle/ui/setup`: the same
 * paper/ink/violet/orange palette and the same fonts. Light only, like the apps.
 */
export const TOKENS = `
:root{
  color-scheme:light;
  --paper:oklch(98.4% .005 85);--ink:oklch(23% .025 290);--ink-muted:oklch(44% .025 290);
  --violet:oklch(46% .17 295);--violet-deep:oklch(38% .15 295);--orange:oklch(68% .17 45);--orange-deep:oklch(52% .16 40);
  --highlight:oklch(92% .12 118);--card:oklch(99.6% .002 85);--muted:oklch(95% .007 85);
  --on-violet:oklch(99% .002 85);--rule:color-mix(in oklch,var(--ink) 12%,transparent);--radius:.5rem;
  --font-display:"Plus Jakarta Sans Variable","Plus Jakarta Sans","Helvetica Neue",Arial,sans-serif;
  --font-body:"Figtree Variable","Figtree","Helvetica Neue",Arial,sans-serif;
  --font-mono:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink);font:16px/1.7 var(--font-body);-webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased;font-optical-sizing:auto}
body{margin:0}
::selection{background:color-mix(in oklch,var(--orange) 35%,transparent)}
`;

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&family=Plus+Jakarta+Sans:wght@400..800&family=JetBrains+Mono:wght@400..700&display=swap";

/** `<link>`s for the design system's fonts; put them in `<head>` */
export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_URL}">`;

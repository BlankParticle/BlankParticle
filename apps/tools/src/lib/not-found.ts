/**
 * The sites' interstitial pages in the www "misprint" design, as self-contained HTML documents
 * (sites are served straight from KV, outside the React app):
 * - `site`: nothing lives at this host (also shown to a signed-in non-owner, so nothing leaks)
 * - `public-page`: a published public site exists, but this path doesn't
 * - `page`: the signed-in owner can see the private site, but this path doesn't
 * - `private`: the site is private and you are not signed in — a button starts sign-in, nothing redirects by itself
 */

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

const STYLE = `
:root{color-scheme:light;--paper:oklch(98% .005 110);--ink:oklch(27% .03 300);--muted:oklch(46% .03 300);--violet:oklch(45% .19 300);--orange:oklch(68% .19 45);--orange-deep:oklch(50% .17 40);--lime:oklch(92% .16 125)}
*{box-sizing:border-box}html{background:var(--paper);color:var(--ink);font:16px/1.6 Karla,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;position:relative}
body::after{content:"";position:fixed;inset:0;pointer-events:none;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
main{max-width:56rem;min-height:100vh;margin:0 auto;padding:0 1.25rem 4rem;display:flex;flex-direction:column}
header,footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem;padding:1rem 0;font-size:.75rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--violet)}
header{border-bottom:2px dashed oklch(45% .19 300/.35)}footer{justify-content:center;border-top:2px dashed oklch(45% .19 300/.35);padding-top:1.5rem}
section{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2rem;padding:4rem 0;text-align:center}
.mark{position:relative}
.mark h1{position:relative;margin:0;font-family:"Bricolage Grotesque",Karla,sans-serif;font-weight:800;font-size:clamp(6rem,20vw,12rem);line-height:1;letter-spacing:-.02em;color:var(--violet)}
.mark h1 b{display:inline-block;transform:rotate(3deg);color:var(--orange-deep);font-weight:inherit}
.dots{position:absolute;border-radius:50%;background-image:radial-gradient(currentColor 1px,transparent 1.5px);background-size:9px 9px}
.dots.a{top:-2rem;right:-2.5rem;width:7rem;height:7rem;color:var(--orange)}.dots.b{bottom:-1.5rem;left:-2.5rem;width:5rem;height:5rem;color:var(--violet)}
.tag{position:absolute;bottom:-.5rem;left:50%;transform:translateX(-50%) rotate(-2deg);white-space:nowrap;border:2px solid var(--ink);background:var(--lime);padding:.125rem .5rem;font-size:.75rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
p{max-width:28rem;margin:0;color:var(--muted)}p code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink);font-weight:700}
.hl{position:relative;display:inline-block;margin:0 .25rem;color:var(--ink);font-weight:700}.hl::before{content:"";position:absolute;inset:1px -3px;z-index:-1;background:var(--lime);transform:rotate(-1deg)}
.actions{display:flex;flex-wrap:wrap;justify-content:center;gap:1rem}
.btn{display:inline-block;padding:.625rem 1.25rem;border:2px solid;border-radius:.375rem;font-weight:700;text-decoration:none;transition:transform .15s,box-shadow .15s}
.btn:hover{transform:translate(2px,2px)}.btn:active{transform:translate(4px,4px);box-shadow:none!important}
.violet{background:var(--violet);color:var(--paper);border-color:var(--ink);box-shadow:4px 4px 0 var(--ink)}.violet:hover{box-shadow:2px 2px 0 var(--ink)}
.orange{background:var(--paper);color:var(--orange-deep);border-color:var(--orange-deep);box-shadow:4px 4px 0 var(--orange)}.orange:hover{box-shadow:2px 2px 0 var(--orange)}
table{width:100%;max-width:40rem;border-collapse:collapse;text-align:left;font-size:.9rem}th{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:.5rem .75rem;border-bottom:2px dashed oklch(45% .19 300/.35)}td{padding:.6rem .75rem;border-bottom:1px solid oklch(27% .03 300/.12);vertical-align:middle}td.n{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;color:var(--muted);white-space:nowrap}td a{color:var(--violet);font-weight:700;text-decoration:none;word-break:break-all}td a:hover{text-decoration:underline}.folder{font-family:"Bricolage Grotesque",Karla,sans-serif;font-weight:800;font-size:clamp(1.75rem,5vw,2.5rem);letter-spacing:-.02em;margin:0}.folder b{color:var(--orange-deep);font-weight:inherit}
.stamp{border:2px dashed var(--orange-deep);border-radius:.25rem;padding:.25rem .5rem;color:var(--orange-deep);transform:rotate(-2deg)}
@media(prefers-reduced-motion:no-preference){.reveal{animation:reveal .5s ease both}.d1{animation-delay:.18s}.d2{animation-delay:.27s}.d3{animation-delay:.36s}@keyframes reveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}
`;

/** One self-contained document in the misprint design; `body` goes inside <section> */
export function shell(options: {
  host: string;
  title: string;
  status: number;
  body: string;
  headerRight?: string;
  stamp: string;
  cacheControl?: string;
}) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(options.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header class="reveal"><span>${escapeHtml(options.host)}</span><span>${options.headerRight ?? "lost &amp; found dept."}</span></header>
<section>
${options.body}
</section>
<footer class="reveal d3"><span class="stamp">${options.stamp}</span></footer>
</main>
</body>
</html>
`;
  return new Response(html, {
    status: options.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": options.cacheControl ?? "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export { escapeHtml };

export type SitePageKind = "site" | "page" | "public-page" | "private" | "files";

export function sitePage(options: {
  host: string;
  kind: SitePageKind;
  toolsOrigin: string;
  rootDomain: string;
  /** Where the sign-in button goes; only used for `private` */
  signInUrl?: string;
}) {
  const host = escapeHtml(options.host);
  const home = `https://${escapeHtml(options.rootDomain)}/`;
  const tools = `https://${escapeHtml(options.toolsOrigin)}/`;
  const variants = {
    site: {
      status: 404,
      big: "4<b>0</b>4",
      tag: "site not published",
      copy: `There is no published site at <code>${host}</code>. Check the address, or publish it from tools first.`,
      actions: `<a class="btn violet" href="${home}">take me home</a><a class="btn orange" href="${tools}">open tools</a>`,
      stamp: "404 · unpublished site",
      title: "Site not published",
      headerRight: "no published site",
    },
    page: {
      status: 404,
      big: "4<b>0</b>4",
      tag: "page not found",
      copy: `This private site exists, but there is no page at this path.`,
      actions: `<a class="btn violet" href="/">back to the site</a><a class="btn orange" href="${home}">take me home</a>`,
      stamp: "404 · missing page",
      title: "Page not found",
      headerRight: "private site · missing page",
    },
    "public-page": {
      status: 404,
      big: "4<b>0</b>4",
      tag: "page not found",
      copy: "Page not found.",
      actions: `<a class="btn violet" href="/">back to the site</a><a class="btn orange" href="${home}">take me home</a>`,
      stamp: "404 · missing page",
      title: "Page not found",
      headerRight: "public site · missing page",
    },
    files: {
      status: 404,
      big: "4<b>0</b>4",
      tag: "nothing here",
      copy: `There is nothing here. It may have<span class="hl">expired</span>, or the link is off by a character.`,
      actions: `<a class="btn violet" href="${home}">take me home</a><a class="btn orange" href="${tools}files">open tools</a>`,
      stamp: "error 404 · misprint",
      title: "File not found",
      headerRight: "lost &amp; found dept.",
    },
    private: {
      status: 401,
      big: "4<b>0</b>1",
      tag: "members only",
      copy: `This one is<span class="hl">private</span>. Sign in to see it — you will land right back here.`,
      actions: `<a class="btn violet" href="${escapeHtml(options.signInUrl ?? tools)}">sign in</a><a class="btn orange" href="${home}">take me home</a>`,
      stamp: "error 401 · members only",
      title: "Sign in required",
      headerRight: "members only",
    },
  } as const;
  const v = variants[options.kind];
  return shell({
    host: options.host,
    title: `${v.title} · ${options.host}`,
    status: v.status,
    stamp: v.stamp,
    headerRight: v.headerRight,
    body: `<div class="mark reveal">
<span class="dots a" aria-hidden="true"></span><span class="dots b" aria-hidden="true"></span>
<h1>${v.big}</h1>
<span class="tag">${v.tag}</span>
</div>
<p class="reveal d1">${v.copy}</p>
<div class="actions reveal d2">${v.actions}</div>`,
  });
}

import * as Effect from "effect/Effect";

import type { Viewer } from "../api/identity.ts";
import type { Site } from "../api/spec.ts";
import { interstitial } from "./not-found.ts";
import { getSite, indexedFiles, readBytes } from "./store.ts";

const decodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
};

/**
 * One indexed page. The index row carries the type and etag, so a revalidation (304) or a HEAD never reads KV;
 * markdown sources are rendered on the way out and tagged by their source's hash, cached like any other page.
 * Null when the index has the path but KV lost the bytes.
 */
const pageResponse = (
  request: Request,
  site: Site,
  file: { path: string; type: string; etag: string },
  options: { render: boolean; status: number },
) =>
  Effect.gen(function* () {
    const etag = options.render ? `"${file.etag}-md"` : `"${file.etag}"`;
    const headers = new Headers({
      "content-type": options.render ? "text/html; charset=utf-8" : file.type,
      etag,
      "cache-control": site.visibility === "private" ? "private, no-store" : "public, max-age=60, must-revalidate",
      "x-content-type-options": "nosniff",
    });
    if (options.status === 200 && request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    if (request.method === "HEAD") return new Response(null, { status: options.status, headers });
    const bytes = yield* readBytes(site.slug, file.path);
    if (bytes === null) return null;
    if (!options.render) return new Response(bytes, { status: options.status, headers });
    // the renderer and its highlighter are heavy; only markdown requests load them
    const { renderMarkdown } = yield* Effect.promise(() => import("./markdown.ts"));
    return new Response(renderMarkdown(file.path, new TextDecoder().decode(bytes)), {
      status: options.status,
      headers,
    });
  });

/**
 * Serves `<slug>.sites.<root>/<path>` from KV, never touching the React app. `viewer` is only resolved for
 * private sites. Returns null when there is no such site so the caller can fall through.
 */
export const serveSite = (request: Request, slug: string, rest: string, viewer: Effect.Effect<Viewer>) =>
  Effect.gen(function* () {
    const path = decodePath(rest);
    if (path === null) return new Response("bad request", { status: 400 });

    // exact files first (an explicit `.md` request gets the raw markdown), then rendered markdown, then the
    // site's own 404 page; one index query covers every candidate
    const directory = path === "" || path.endsWith("/");
    const candidates = [
      ...(directory ? [`${path}index.html`] : [path, `${path}.html`, `${path}/index.html`]).map((candidate) => ({
        path: candidate,
        render: false,
        status: 200,
      })),
      ...(directory
        ? [`${path}index.md`, `${path}README.md`]
        : [`${path}.md`, `${path}/index.md`, `${path}/README.md`]
      ).map((candidate) => ({ path: candidate, render: true, status: 200 })),
      { path: "404.html", render: false, status: 404 },
    ];
    const [site, indexed] = yield* Effect.all(
      [
        getSite(slug),
        indexedFiles(
          slug,
          candidates.map((candidate) => candidate.path),
        ),
      ],
      { concurrency: "unbounded" },
    );
    if (site === null) return null;

    if (site.visibility === "private") {
      const { signedIn, login } = yield* viewer;
      // signed in as someone else: nothing to see; anonymous: a page with a sign-in button (the auth cookie is
      // scoped to the root domain, so one sign-in through tools covers every site)
      if (login !== site.owner) return yield* interstitial(request, signedIn ? "site" : "private");
    }

    for (const candidate of candidates) {
      const file = indexed.find((row) => row.path === candidate.path);
      if (file === undefined) continue;
      const response = yield* pageResponse(request, site, file, candidate);
      if (response !== null) return response;
    }
    return yield* interstitial(request, site.visibility === "public" ? "public-page" : "page");
  });

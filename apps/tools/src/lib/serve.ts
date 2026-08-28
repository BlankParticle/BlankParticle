import * as Effect from "effect/Effect";

import type { Site } from "../api/spec.ts";
import { WorkerEnv } from "./env.ts";
import { renderMarkdown } from "./markdown.ts";
import { sitePage } from "./not-found.ts";
import { getFile, getSite, type StoredFile } from "./store.ts";

const decodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
};

const fileResponse = (request: Request, file: StoredFile, site: Site, status = 200) => {
  const etag = `"${file.meta.etag}"`;
  const headers = new Headers({
    "content-type": file.meta.type,
    etag,
    "cache-control": site.visibility === "private" ? "private, no-store" : "public, max-age=60, must-revalidate",
    "x-content-type-options": "nosniff",
  });
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(request.method === "HEAD" ? null : file.value, { status, headers });
};

const markdownResponse = (request: Request, path: string, source: StoredFile) =>
  new Response(request.method === "HEAD" ? null : renderMarkdown(path, new TextDecoder().decode(source.value)), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

/** The interstitial pages for this host; `private` carries the sign-in link (the button navigates, we never redirect) */
export const missing = (request: Request, kind: "site" | "page" | "public-page" | "private") =>
  Effect.map(WorkerEnv, (env) => {
    const signIn = new URL(`https://${env.ORIGINS.tools}/auth/login`);
    signIn.searchParams.set("return_to", request.url);
    return sitePage({
      host: new URL(request.url).host,
      kind,
      toolsOrigin: env.ORIGINS.tools,
      rootDomain: env.ROOT_DOMAIN,
      signInUrl: signIn.toString(),
    });
  });

/** Who is looking: `login` is the allow-listed owner identity if any; `signedIn` covers any valid session */
export type Viewer = { signedIn: boolean; login: string | undefined };

/**
 * Serves `<slug>.sites.<root>/<path>` straight from KV, never touching the React app.
 * Returns null when there is no such site so the caller can fall through.
 */
export const serveSite = (request: Request, slug: string, rest: string, viewer: Viewer) =>
  Effect.gen(function* () {
    const site = yield* getSite(slug);
    if (site === null) return null;

    if (site.visibility === "private" && viewer.login !== site.owner) {
      // signed in as someone else: nothing to see; anonymous: a page with a sign-in button (the auth cookie is
      // scoped to the root domain, so one sign-in through tools covers every site)
      return yield* missing(request, viewer.signedIn ? "site" : "private");
    }

    const path = decodePath(rest);
    if (path === null) return new Response("bad request", { status: 400 });

    // exact files first (an explicit `.md` request gets the raw markdown), then prerendered markdown
    const directory = path === "" || path.endsWith("/");
    const files = directory ? [`${path}index.html`] : [path, `${path}.html`, `${path}/index.html`];
    for (const candidate of files) {
      const file = yield* getFile(slug, candidate);
      if (file !== null) return fileResponse(request, file, site);
    }
    const rendered = directory
      ? [`${path}index.md`, `${path}README.md`]
      : [`${path}.md`, `${path}/index.md`, `${path}/README.md`];
    for (const candidate of rendered) {
      const source = yield* getFile(slug, candidate);
      if (source === null) continue;
      return markdownResponse(request, candidate, source);
    }

    const custom = yield* getFile(slug, "404.html");
    return custom !== null
      ? fileResponse(request, custom, site, 404)
      : yield* missing(request, site.visibility === "public" ? "public-page" : "page");
  });

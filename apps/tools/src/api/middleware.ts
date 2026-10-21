import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { WorkerEnv } from "#/lib/env.ts";
import { serveBundle, serveFile } from "#/lib/files.ts";
import { interstitial } from "#/lib/not-found.ts";
import { serveSite } from "#/lib/serve.ts";

import { isLoopback } from "./host.ts";
import { currentViewer } from "./identity.ts";
import { isValidSlug } from "./spec.ts";

/** Host aliases take precedence over path routes: files and sites may contain paths such as `/api`. */
export const HostDispatch = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const env = yield* WorkerEnv;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const url = new URL(request.originalUrl);
      const [, head = "", ...rest] = url.pathname.split("/");
      const siteSuffix = import.meta.env.DEV ? ".localhost" : `.${env.ORIGINS.sites}`;
      const siteSlug = url.hostname.endsWith(siteSuffix) ? url.hostname.slice(0, -siteSuffix.length) : null;
      const onFiles = url.hostname === env.ORIGINS.files;
      const isPageRequest = request.method === "GET" || request.method === "HEAD";
      // verifying the session is a JWKS check; public content never needs it, private content resolves it once
      const viewer = yield* Effect.cached(
        currentViewer.pipe(
          Effect.provideService(WorkerEnv, env),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request),
        ),
      );

      if (url.hostname === env.ORIGINS.email) return HttpServerResponse.redirect(`https://${env.ORIGINS.tools}/email`);

      if (siteSlug !== null) {
        const webRequest = yield* HttpServerRequest.toWeb(request);
        if (isPageRequest && isValidSlug(siteSlug)) {
          const response = yield* serveSite(webRequest, siteSlug, url.pathname.slice(1), viewer);
          if (response !== null) return HttpServerResponse.fromWeb(response);
        }
        return HttpServerResponse.fromWeb(yield* interstitial(webRequest, "site"));
      }
      if (url.hostname === env.ORIGINS.sites) return HttpServerResponse.redirect(`https://${env.ORIGINS.tools}/`);

      // files.<root>/[private/]<id>/<name>; in dev, localhost/f/[private/]<id>/<name>
      if (onFiles || (isLoopback(url.hostname) && head === "f")) {
        const segments = onFiles ? [head, ...rest] : rest;
        const visibility = segments[0] === "private" ? "private" : "public";
        const [id = "", ...nameParts] = visibility === "private" ? segments.slice(1) : segments;
        if (!isPageRequest || id === "") return HttpServerResponse.redirect(`https://${env.ORIGINS.tools}/files`);
        const webRequest = yield* HttpServerRequest.toWeb(request);
        const name = nameParts.map((part) => decodeURIComponent(part)).join("/");
        const response =
          name === ""
            ? serveBundle(webRequest, id, visibility, viewer)
            : serveFile(webRequest, id, name, visibility, viewer);
        return HttpServerResponse.fromWeb(yield* response);
      }

      return yield* httpEffect;
    }),
  { global: true },
);

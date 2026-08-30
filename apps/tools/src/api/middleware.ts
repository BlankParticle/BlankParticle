import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { WorkerEnv } from "#/lib/env.ts";
import { serveBundle, serveFile } from "#/lib/files.ts";
import { missing, serveSite } from "#/lib/serve.ts";

import { currentIdentity } from "./identity.ts";
import { isValidSlug } from "./spec.ts";

/** Host aliases take precedence over path routes: files and sites may contain paths such as `/api`. */
export const HostDispatch = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const env = yield* WorkerEnv;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const webRequest = yield* Effect.fromResult(HttpServerRequest.toWebResult(request));
      const url = new URL(request.originalUrl);
      const [, head = "", ...rest] = url.pathname.split("/");
      const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const siteSuffix = import.meta.env.DEV ? ".localhost" : `.${env.ORIGINS.sites}`;
      const siteSlug = url.hostname.endsWith(siteSuffix) ? url.hostname.slice(0, -siteSuffix.length) : null;
      const isPageRequest = request.method === "GET" || request.method === "HEAD";

      if (url.hostname === env.ORIGINS.email) return HttpServerResponse.redirect(`https://${env.ORIGINS.tools}/email`);

      const onFiles = url.hostname === env.ORIGINS.files;
      if (onFiles || (isLocal && head === "f")) {
        const identity = yield* currentIdentity;
        const viewer = { signedIn: identity !== undefined, login: identity?.allowed ? identity.login : undefined };
        const privateRequest = (onFiles && head === "private") || (isLocal && head === "f" && rest[0] === "private");
        const [id = "", ...nameParts] = onFiles
          ? privateRequest
            ? rest
            : [head, ...rest]
          : privateRequest
            ? rest.slice(1)
            : rest;
        if (!isPageRequest || id === "") return HttpServerResponse.redirect(`https://${env.ORIGINS.tools}/files`);
        const name = nameParts.map((part) => decodeURIComponent(part)).join("/");
        const response =
          name === ""
            ? serveBundle(webRequest, id, privateRequest ? "private" : "public", viewer)
            : serveFile(webRequest, id, name, privateRequest ? "private" : "public", viewer);
        return HttpServerResponse.fromWeb(yield* response);
      }

      if (siteSlug !== null) {
        const identity = yield* currentIdentity;
        const viewer = { signedIn: identity !== undefined, login: identity?.allowed ? identity.login : undefined };
        if (isPageRequest && isValidSlug(siteSlug)) {
          const response = yield* serveSite(webRequest, siteSlug, url.pathname.slice(1), viewer);
          if (response !== null) return HttpServerResponse.fromWeb(response);
        }
        return HttpServerResponse.fromWeb(yield* missing(webRequest, "site"));
      }
      if (url.hostname === env.ORIGINS.sites) return HttpServerResponse.redirect(`https://${env.ORIGINS.tools}/`);

      return yield* httpEffect;
    }),
  { global: true },
);

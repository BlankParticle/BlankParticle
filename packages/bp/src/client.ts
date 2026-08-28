import type { ManifestFile, SharedFile, Site, SiteFile, User, Visibility } from "@blankparticle/tools/spec";
import * as Effect from "effect/Effect";
import * as Flag from "effect/unstable/cli/Flag";
import * as HttpClient from "effect/unstable/http/HttpClient";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

import { accessToken } from "./oauth.ts";
import { UserError } from "./runtime.ts";

export const DEFAULT_URL = "https://tools.blankparticle.com";

type ManifestResponse = { id: string; files: Array<{ name: string; uploaded: boolean }>; url: string };
declare const ResponseType: unique symbol;
type ApiRequest<A> = Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  HttpClientError.HttpClientError,
  HttpClient.HttpClient
> & { readonly [ResponseType]: A };

export const makeClient = (baseUrl: string, accessToken: string) => {
  const request = <A>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      query?: Record<string, string | undefined>;
      json?: unknown;
      bytes?: Uint8Array;
      contentType?: string | undefined;
    } = {},
  ) => {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    let outgoing = HttpClientRequest.make(options.method ?? "GET")(url).pipe(
      HttpClientRequest.setHeader("authorization", `Bearer ${accessToken}`),
    );
    if (options.json !== undefined) outgoing = HttpClientRequest.bodyJsonUnsafe(outgoing, options.json);
    if (options.bytes !== undefined)
      outgoing = HttpClientRequest.bodyUint8Array(outgoing, options.bytes, options.contentType);
    return HttpClient.execute(outgoing) as ApiRequest<A>;
  };

  return {
    api: {
      me: { $get: () => request<User>("/api/me") },
      sites: {
        $get: () => request<Site[]>("/api/sites"),
        [":slug"]: {
          $get: ({ param }: { param: { slug: string } }) =>
            request<{ site: Site; files: SiteFile[] }>(`/api/sites/${encodeURIComponent(param.slug)}`),
          $put: ({ param, json }: { param: { slug: string }; json: { visibility?: Visibility | undefined } }) =>
            request<Site>(`/api/sites/${encodeURIComponent(param.slug)}`, { method: "PUT", json }),
          $delete: ({ param }: { param: { slug: string } }) =>
            request<void>(`/api/sites/${encodeURIComponent(param.slug)}`, { method: "DELETE" }),
          files: {
            $put: (
              { param, query }: { param: { slug: string }; query: { path: string; type?: string } },
              options: { init: { body: Uint8Array }; headers?: Record<string, string> },
            ) =>
              request<SiteFile>(`/api/sites/${encodeURIComponent(param.slug)}/files`, {
                method: "PUT",
                query,
                bytes: options.init.body,
                contentType: options.headers?.["content-type"],
              }),
            $get: ({ param, query }: { param: { slug: string }; query: { path: string } }) =>
              request<never>(`/api/sites/${encodeURIComponent(param.slug)}/files`, { query }),
            $delete: ({ param, query }: { param: { slug: string }; query: { path: string } }) =>
              request<void>(`/api/sites/${encodeURIComponent(param.slug)}/files`, { method: "DELETE", query }),
          },
          sync: {
            $post: ({ param, json }: { param: { slug: string }; json: { keep: string[] } }) =>
              request<{ removed: string[] }>(`/api/sites/${encodeURIComponent(param.slug)}/sync`, {
                method: "POST",
                json,
              }),
          },
        },
      },
      files: {
        $get: () => request<SharedFile[]>("/api/files"),
        manifest: {
          $post: ({ json }: { json: { id?: string; files: ManifestFile[]; ttl?: string; visibility?: Visibility } }) =>
            request<ManifestResponse>("/api/files/manifest", { method: "POST", json }),
        },
        [":id"]: {
          $get: ({ param }: { param: { id: string } }) =>
            request<SharedFile[]>(`/api/files/${encodeURIComponent(param.id)}`),
          $delete: ({ param }: { param: { id: string } }) =>
            request<void>(`/api/files/${encodeURIComponent(param.id)}`, { method: "DELETE" }),
          upload: {
            $put: (
              { param, query }: { param: { id: string }; query: { name: string } },
              options: { init: { body: Uint8Array }; headers?: Record<string, string> },
            ) =>
              request<SharedFile>(`/api/files/${encodeURIComponent(param.id)}/upload`, {
                method: "PUT",
                query,
                bytes: options.init.body,
                contentType: options.headers?.["content-type"],
              }),
          },
          download: {
            $get: ({ param, query }: { param: { id: string }; query: { name: string } }) =>
              request<never>(`/api/files/${encodeURIComponent(param.id)}/download`, { query }),
          },
        },
      },
    },
  };
};

export type Client = ReturnType<typeof makeClient>;

const describe = (status: number, body: unknown) => {
  const detail = typeof body === "object" && body !== null && "error" in body ? String(body.error) : undefined;
  switch (status) {
    case 401:
      return detail ?? "unauthorized: run `bp login`";
    case 403:
      return detail ?? "forbidden: that site belongs to someone else";
    case 404:
      return detail ?? "not found: no such site";
    default:
      return `request failed with ${status}${detail ? `: ${detail}` : ""}`;
  }
};

const execute = <A>(request: ApiRequest<A>) =>
  request.pipe(Effect.mapError((cause) => new UserError({ message: `could not reach the server: ${cause}` })));

/** Runs an API request and decodes its JSON body inside Effect. */
export const call = <A>(request: () => ApiRequest<A>) =>
  Effect.gen(function* () {
    const response = yield* execute(request());
    if (response.status < 200 || response.status >= 300) {
      const body = yield* response.json.pipe(Effect.catch(() => Effect.succeed(null)));
      return yield* new UserError({ message: describe(response.status, body) });
    }
    if (response.status === 204) return undefined as A;
    return (yield* response.json) as A;
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof UserError ? cause : new UserError({ message: `invalid server response: ${cause}` }),
    ),
  );

/** Like `call`, for endpoints that answer with raw bytes. */
export const download = (request: () => ApiRequest<never>) =>
  Effect.gen(function* () {
    const response = yield* execute(request());
    if (response.status < 200 || response.status >= 300) {
      const body = yield* response.json.pipe(Effect.catch(() => Effect.succeed(null)));
      return yield* new UserError({ message: describe(response.status, body) });
    }
    return new Uint8Array(yield* response.arrayBuffer);
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof UserError ? cause : new UserError({ message: `invalid server response: ${cause}` }),
    ),
  );

export const shared = {
  url: Flag.string("url").pipe(
    Flag.withDefault(process.env.BP_URL ?? DEFAULT_URL),
    Flag.withDescription("Base URL of tools.blankparticle.com (env: BP_URL)"),
  ),
};

export const client = (options: { url: string }) =>
  Effect.map(accessToken(options.url), (token) => makeClient(options.url, token));

export const fail = (message: string) => Effect.fail(new UserError({ message }));

/** A generated slug must not land on an existing site (yours would be overwritten, someone else's is a 403) */

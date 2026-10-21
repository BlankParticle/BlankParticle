import { SharedFile, Site, SiteFile, User, type ManifestFile, type Visibility } from "@blankparticle/tools/spec";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Schema from "effect/Schema";

import { accessToken } from "./oauth.ts";
import { fail, UserError } from "./runtime.ts";

export const DEFAULT_URL = "https://tools.blankparticle.com";

const SiteDetails = Schema.Struct({ site: Site, files: Schema.Array(SiteFile) });
const SyncResult = Schema.Struct({ removed: Schema.Array(Schema.String) });
const ManifestResult = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  files: Schema.Array(Schema.Struct({ name: Schema.String, uploaded: Schema.Boolean })),
});

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

const invalidResponse = (cause: unknown) => new UserError({ message: `invalid server response: ${cause}` });

const decode =
  <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  (response: HttpClientResponse.HttpClientResponse) =>
    HttpClientResponse.schemaBodyJson(schema)(response).pipe(Effect.mapError(invalidResponse));

const bytes = (response: HttpClientResponse.HttpClientResponse) =>
  response.arrayBuffer.pipe(
    Effect.map((buffer) => new Uint8Array(buffer)),
    Effect.mapError(invalidResponse),
  );

/** The tools API: one function per endpoint the CLI calls, JSON responses decoded with the shared spec schemas */
export const makeClient = (baseUrl: string, token: string) => {
  const request = (method: "GET" | "POST" | "PUT" | "DELETE", path: string, query?: Record<string, string>) =>
    HttpClientRequest.make(method)(new URL(path, baseUrl), { urlParams: query }).pipe(
      HttpClientRequest.bearerToken(token),
    );

  const execute = (outgoing: HttpClientRequest.HttpClientRequest) =>
    HttpClient.execute(outgoing).pipe(
      Effect.mapError((cause) => new UserError({ message: `could not reach the server: ${cause}` })),
    );

  /** Executes the request; any status outside 2xx fails with the server's message */
  const send = (outgoing: HttpClientRequest.HttpClientRequest) =>
    Effect.flatMap(execute(outgoing), (response) =>
      response.status >= 200 && response.status < 300
        ? Effect.succeed(response)
        : response.json.pipe(
            Effect.catch(() => Effect.succeed(null)),
            Effect.flatMap((body) => fail(describe(response.status, body))),
          ),
    );

  /** Streams a local file as the request body */
  const upload = (outgoing: HttpClientRequest.HttpClientRequest, file: string, contentType: string) =>
    HttpClientRequest.bodyFile(file, { contentType })(outgoing).pipe(
      Effect.mapError((cause) => new UserError({ message: `could not read ${file}: ${cause.message}` })),
      Effect.flatMap(send),
    );

  const site = (slug: string) => `/api/sites/${encodeURIComponent(slug)}`;
  const share = (id: string) => `/api/files/${encodeURIComponent(id)}`;

  return {
    me: () => send(request("GET", "/api/me")).pipe(Effect.flatMap(decode(User))),

    listSites: () => send(request("GET", "/api/sites")).pipe(Effect.flatMap(decode(Schema.Array(Site)))),
    getSite: (slug: string) => send(request("GET", site(slug))).pipe(Effect.flatMap(decode(SiteDetails))),
    /** Whether the slug is in use at all: yours, someone else's, public or private */
    siteTaken: (slug: string) => Effect.map(execute(request("GET", site(slug))), (response) => response.status !== 404),
    putSite: (slug: string, visibility: Visibility | undefined) =>
      send(HttpClientRequest.bodyJsonUnsafe(request("PUT", site(slug)), { visibility })).pipe(
        Effect.flatMap(decode(Site)),
      ),
    deleteSite: (slug: string) => send(request("DELETE", site(slug))).pipe(Effect.asVoid),
    putSiteFile: (slug: string, path: string, file: string, type: string) =>
      upload(request("PUT", `${site(slug)}/files`, { path, type }), file, type).pipe(Effect.flatMap(decode(SiteFile))),
    getSiteFile: (slug: string, path: string) =>
      send(request("GET", `${site(slug)}/files`, { path })).pipe(Effect.flatMap(bytes)),
    syncSite: (slug: string, keep: ReadonlyArray<string>) =>
      send(HttpClientRequest.bodyJsonUnsafe(request("POST", `${site(slug)}/sync`), { keep })).pipe(
        Effect.flatMap(decode(SyncResult)),
      ),

    listShares: () => send(request("GET", "/api/files")).pipe(Effect.flatMap(decode(Schema.Array(SharedFile)))),
    registerManifest: (manifest: { files: ReadonlyArray<ManifestFile>; ttl: string; visibility: Visibility }) =>
      send(HttpClientRequest.bodyJsonUnsafe(request("POST", "/api/files/manifest"), manifest)).pipe(
        Effect.flatMap(decode(ManifestResult)),
      ),
    getShare: (id: string) => send(request("GET", share(id))).pipe(Effect.flatMap(decode(Schema.Array(SharedFile)))),
    deleteShare: (id: string) => send(request("DELETE", share(id))).pipe(Effect.asVoid),
    uploadShareFile: (id: string, name: string, file: string, type: string) =>
      upload(request("PUT", `${share(id)}/upload`, { name }), file, type).pipe(Effect.flatMap(decode(SharedFile))),
    downloadShareFile: (id: string, name: string) =>
      send(request("GET", `${share(id)}/download`, { name })).pipe(Effect.flatMap(bytes)),
  };
};

export type Client = ReturnType<typeof makeClient>;

export const shared = {
  url: Flag.String("url").pipe(
    Flag.withDefault(process.env.BP_URL ?? DEFAULT_URL),
    Flag.withDescription("Base URL of tools.blankparticle.com (env: BP_URL)"),
  ),
};

export const client = (options: { url: string }) =>
  Effect.map(accessToken(options.url), (token) => makeClient(options.url, token));

import { ToolsApi } from "@blankparticle/tools/spec";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";

import { accessToken } from "./oauth.ts";

export const DEFAULT_URL = "https://tools.blankparticle.com";

/** The tools API client, derived from the shared spec, every request carrying the stored bearer token */
export const makeClient = (baseUrl: string, token: string) =>
  Effect.gen(function* () {
    const httpClient = HttpClient.mapRequest(yield* HttpClient.HttpClient, HttpClientRequest.bearerToken(token));
    const api = yield* HttpApiClient.makeWith(ToolsApi, { httpClient, baseUrl });

    /** Upload endpoints take raw bytes as the body, so their client sends a local file, streamed from disk */
    const sending = (file: string, contentType: string) =>
      Effect.map(HttpBody.file(file, { contentType }), (body) =>
        HttpClient.mapRequest(httpClient, HttpClientRequest.setBody(body)),
      );

    return {
      ...api,
      putSiteFile: (slug: string, path: string, file: string, type: string) =>
        sending(file, type).pipe(
          Effect.flatMap((client) =>
            HttpApiClient.endpoint(ToolsApi, { group: "sites", endpoint: "putFile", httpClient: client, baseUrl }),
          ),
          Effect.flatMap((putFile) => putFile({ params: { slug }, query: { path, type } })),
        ),
      uploadShareFile: (id: string, name: string, file: string, type: string) =>
        sending(file, type).pipe(
          Effect.flatMap((client) =>
            HttpApiClient.endpoint(ToolsApi, { group: "files", endpoint: "upload", httpClient: client, baseUrl }),
          ),
          Effect.flatMap((upload) => upload({ params: { id }, query: { name } })),
        ),
    };
  });

export type Client = Effect.Success<ReturnType<typeof makeClient>>;

export const shared = {
  url: Flag.String("url").pipe(
    Flag.withDefault(process.env.BP_URL ?? DEFAULT_URL),
    Flag.withDescription("Base URL of tools.blankparticle.com (env: BP_URL)"),
  ),
};

export const client = (options: { url: string }) =>
  Effect.flatMap(accessToken(options.url), (token) => makeClient(options.url, token));

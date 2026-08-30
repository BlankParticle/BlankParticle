import * as S from "effect/Schema";

import { NATIVE_CLIENT_ID } from "#/lib/clients.ts";

const ClientMetadata = S.Struct({
  client_name: S.optional(S.String.check(S.isMaxLength(64))),
  logo_uri: S.optional(S.String.check(S.isPattern(/^https:\/\/\S{1,500}$/))),
  pii: S.optional(S.String),
  resource: S.optional(S.String),
});

const AuthorizationFields = {
  redirect_uri: S.String,
  state: S.String,
  code_challenge: S.String,
  code_challenge_method: S.Literal("S256"),
  response_type: S.optional(S.Literal("code")),
  ...ClientMetadata.fields,
};

export const AuthorizationQuery = S.Union([
  S.Struct({
    ...AuthorizationFields,
    client_type: S.Literal("web"),
    client_id: S.optional(S.String),
  }),
  S.Struct({
    ...AuthorizationFields,
    client_type: S.Literal("native"),
    client_id: S.String.check(S.isPattern(NATIVE_CLIENT_ID), S.isMaxLength(128)),
  }),
]);

export const GitHubUser = S.Struct({
  id: S.Number,
  login: S.String,
  name: S.NullOr(S.String),
  avatar_url: S.String,
});

export const GitHubEmails = S.Array(S.Struct({ email: S.String, primary: S.Boolean, verified: S.Boolean }));

export const GitHubToken = S.Struct({
  access_token: S.optional(S.String),
  error: S.optional(S.String),
});

export const DeviceCodeForm = S.Struct({
  client_id: S.String.check(S.isPattern(NATIVE_CLIENT_ID), S.isMaxLength(128)),
  ...ClientMetadata.fields,
});

export const CallbackQuery = S.Struct({
  state: S.String,
  code: S.optional(S.String),
  error: S.optional(S.String),
});

export const ConsentForm = S.Struct({
  token: S.String,
  decision: S.Literals(["allow", "deny"]),
});

export const TokenForm = S.Union([
  S.Struct({
    grant_type: S.Literal("authorization_code"),
    code: S.String,
    client_id: S.String,
    redirect_uri: S.String,
    code_verifier: S.String,
  }),
  S.Struct({
    grant_type: S.Literal("urn:ietf:params:oauth:grant-type:device_code"),
    device_code: S.String,
    client_id: S.String,
  }),
]);

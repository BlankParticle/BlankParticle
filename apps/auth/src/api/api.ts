import { Context, type Redacted } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "effect/http-api";
import * as S from "effect/Schema";

import { DeviceCodeForm, TokenForm } from "./schema.ts";

/** RFC 6749 §5.2 / RFC 8628 §3.5 error body; clients branch on `error`, so each status gets its own class */
export class OAuthError extends S.Error<OAuthError>("auth/OAuthError")(
  {
    error: S.Literals([
      "invalid_request",
      "invalid_grant",
      "expired_token",
      "slow_down",
      "authorization_pending",
      "access_denied",
    ]),
    error_description: S.optional(S.String),
  },
  { httpApiStatus: 400 },
) {}

/** The code exchange answers a mismatched code, client, redirect or verifier with 401 */
export class InvalidGrant extends S.Error<InvalidGrant>("auth/InvalidGrant")(
  { error: S.Literal("invalid_grant") },
  { httpApiStatus: 401 },
) {}

export class TemporarilyUnavailable extends S.Error<TemporarilyUnavailable>("auth/TemporarilyUnavailable")(
  { error: S.Literal("temporarily_unavailable"), error_description: S.String },
  { httpApiStatus: 503 },
) {}

export class LoginRequired extends S.Error<LoginRequired>("auth/LoginRequired")(
  { status: S.Literal("login_required"), reason: S.Literals(["invalid_token", "revoked", "expired"]) },
  { httpApiStatus: 401 },
) {}

/** Malformed form bodies (bad fields or content type) become `invalid_request` instead of an empty 400/415 */
export class OAuthRequest extends HttpApiMiddleware.Service<OAuthRequest>()("auth/OAuthRequest", {
  error: OAuthError,
}) {}

export class BearerToken extends Context.Service<BearerToken, Redacted.Redacted>()("auth/BearerToken") {}

/** Only decodes the credential: verifying it needs the per-request D1 binding, which middleware can't require */
export class BearerAuth extends HttpApiMiddleware.Service<BearerAuth, { provides: BearerToken }>()("auth/BearerAuth", {
  security: { bearer: HttpApiSecurity.bearer },
}) {}

const Jwk = S.Struct({
  kty: S.optional(S.String),
  x: S.optional(S.String),
  y: S.optional(S.String),
  crv: S.optional(S.String),
  kid: S.String,
  alg: S.String,
  use: S.String,
});

const OpenIdConfiguration = S.Struct({
  issuer: S.String,
  authorization_endpoint: S.String,
  device_authorization_endpoint: S.String,
  token_endpoint: S.String,
  jwks_uri: S.String,
  revocation_endpoint: S.String,
  response_types_supported: S.Array(S.String),
  subject_types_supported: S.Array(S.String),
  id_token_signing_alg_values_supported: S.Array(S.String),
  token_endpoint_auth_methods_supported: S.Array(S.String),
  grant_types_supported: S.Array(S.String),
  code_challenge_methods_supported: S.Array(S.String),
  claims_supported: S.Array(S.String),
});

const DeviceAuthorization = S.Struct({
  device_code: S.String,
  user_code: S.String,
  verification_uri: S.String,
  verification_uri_complete: S.String,
  expires_in: S.Number,
  interval: S.Number,
});

const TokenResponse = S.Struct({
  id_token: S.String,
  pairwise_sub: S.String,
  token_type: S.Literal("Bearer"),
  expires_in: S.Number,
});

const Discovery = HttpApiGroup.make("discovery")
  .add(HttpApiEndpoint.get("jwks", "/.well-known/jwks.json", { success: S.Struct({ keys: S.Array(Jwk) }) }))
  .add(
    HttpApiEndpoint.get("openIdConfiguration", "/.well-known/openid-configuration", { success: OpenIdConfiguration }),
  );

const Tokens = HttpApiGroup.make("tokens")
  .add(
    HttpApiEndpoint.post("deviceCode", "/device/code", {
      payload: DeviceCodeForm.pipe(HttpApiSchema.asFormUrlEncoded()),
      success: DeviceAuthorization,
      error: [OAuthError, TemporarilyUnavailable],
    }),
  )
  .add(
    HttpApiEndpoint.post("token", "/token", {
      payload: TokenForm.pipe(HttpApiSchema.asFormUrlEncoded()),
      success: TokenResponse,
      error: [OAuthError, InvalidGrant],
    }),
  )
  .middleware(OAuthRequest);

const Sessions = HttpApiGroup.make("sessions")
  .add(
    HttpApiEndpoint.post("check", "/session/check", {
      success: S.Struct({ status: S.Literal("active") }),
      error: LoginRequired,
    }),
  )
  .add(HttpApiEndpoint.post("revoke", "/session/revoke"))
  .middleware(BearerAuth);

/** Machine-facing endpoints; the browser redirect flows and pages stay plain router routes */
export const AuthApi = HttpApi.make("auth").add(Discovery).add(Tokens).add(Sessions);

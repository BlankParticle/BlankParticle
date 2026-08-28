import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

import { WorkerEnv } from "../context.ts";

const Jwks = HttpRouter.add(
  "GET",
  "/.well-known/jwks.json",
  Effect.map(WorkerEnv, (env) => HttpServerResponse.jsonUnsafe(env.JWKS)),
);

const OpenIdConfiguration = HttpRouter.add(
  "GET",
  "/.well-known/openid-configuration",
  Effect.map(WorkerEnv, (env) =>
    HttpServerResponse.jsonUnsafe({
      issuer: env.ISSUER,
      authorization_endpoint: `${env.ISSUER}/authorize`,
      device_authorization_endpoint: `${env.ISSUER}/device/code`,
      token_endpoint: `${env.ISSUER}/token`,
      jwks_uri: `${env.ISSUER}/.well-known/jwks.json`,
      revocation_endpoint: `${env.ISSUER}/session/revoke`,
      response_types_supported: ["code"],
      subject_types_supported: ["pairwise"],
      id_token_signing_alg_values_supported: ["ES256"],
      token_endpoint_auth_methods_supported: ["none"],
      grant_types_supported: ["authorization_code", "urn:ietf:params:oauth:grant-type:device_code"],
      code_challenge_methods_supported: ["S256"],
      claims_supported: [
        "iss",
        "sub",
        "aud",
        "exp",
        "iat",
        "jti",
        "pairwise_sub",
        "login",
        "name",
        "picture",
        "email",
        "email_verified",
        "pii_sub",
      ],
    }),
  ),
);

export const DiscoveryRoutes = Layer.mergeAll(Jwks, OpenIdConfiguration);

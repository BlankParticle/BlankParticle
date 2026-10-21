import { Effect } from "effect";
import { createLocalJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from "jose";

import type { AuthAppEnv } from "../../alchemy.config.ts";

/**
 * ES256 signing key for id_tokens. Generated once by `Alchemy.KeyPair` at deploy time and handed to
 * the Worker as PEM pkcs8 (`SIGNING_KEY`); its public JWKS (with the `kid`) is precomputed into the
 * `JWKS` binding. Replace the KeyPair resource to rotate.
 */
const ALG = "ES256";

type KeyEnv = Pick<AuthAppEnv, "SIGNING_KEY" | "JWKS">;

let cached: { pem: string; privateKey: Promise<CryptoKey>; jwks: ReturnType<typeof createLocalJWKSet> } | undefined;

/** Imported once per isolate (keyed on the PEM so a rotated deploy is picked up) */
function keys(env: KeyEnv) {
  if (cached?.pem !== env.SIGNING_KEY) {
    cached = {
      pem: env.SIGNING_KEY,
      privateKey: importPKCS8(env.SIGNING_KEY, ALG),
      jwks: createLocalJWKSet(env.JWKS),
    };
  }
  return cached;
}

export function signIdToken(env: KeyEnv, claims: JWTPayload & { iss: string; aud: string; sub: string }) {
  return Effect.gen(function* () {
    const { privateKey: keyPromise } = keys(env);
    const privateKey = yield* Effect.tryPromise(() => keyPromise);
    const { kid } = env.JWKS.keys[0];
    return yield* Effect.tryPromise(() =>
      new SignJWT(claims).setProtectedHeader({ alg: ALG, kid, typ: "JWT" }).sign(privateKey),
    );
  });
}

/** Verifies signature, issuer and expiry against our published JWKS; returns the payload or `null` */
export function verifyIdToken(env: KeyEnv, token: string, issuer: string) {
  const { jwks } = keys(env);
  return Effect.tryPromise(() => jwtVerify(token, jwks, { issuer, algorithms: [ALG] })).pipe(
    Effect.map(({ payload }) => payload),
    Effect.catchCause(() => Effect.succeed(null)),
  );
}

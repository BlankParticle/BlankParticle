import { Effect } from "effect";
import { calculateJwkThumbprint, exportJWK, importJWK, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * ES256 signing key for id_tokens. Generated once by `Alchemy.KeyPair` at deploy time and handed to
 * the Worker as PEM pkcs8 (`SIGNING_KEY`); its public JWKS is precomputed into the `JWKS` binding.
 * Replace the KeyPair resource to rotate.
 */
const ALG = "ES256";

type Keys = { privateKey: CryptoKey; publicKey: CryptoKey; kid: string };
type KeyEnv = { SIGNING_KEY: string };

let cached: { pem: string; keys: Promise<Keys> } | undefined;

/** Imported once per isolate (keyed on the PEM so a rotated deploy is picked up) */
function keys(env: KeyEnv) {
  if (cached?.pem !== env.SIGNING_KEY) {
    cached = {
      pem: env.SIGNING_KEY,
      keys: (async () => {
        const privateKey = await importPKCS8(env.SIGNING_KEY, ALG, { extractable: true });
        const { d: _d, ...publicJwk } = await exportJWK(privateKey);
        const kid = await calculateJwkThumbprint(publicJwk);
        const publicKey = (await importJWK(publicJwk, ALG)) as CryptoKey;
        return { privateKey, publicKey, kid };
      })(),
    };
  }
  const keyPromise = cached.keys;
  return Effect.tryPromise(() => keyPromise);
}

export function signIdToken(env: KeyEnv, claims: JWTPayload & { iss: string; aud: string; sub: string }) {
  return Effect.gen(function* () {
    const { privateKey, kid } = yield* keys(env);
    return yield* Effect.tryPromise(() =>
      new SignJWT(claims).setProtectedHeader({ alg: ALG, kid, typ: "JWT" }).sign(privateKey),
    );
  });
}

/** Verifies signature, issuer and expiry against our own key; returns the payload or `null` */
export function verifyIdToken(env: KeyEnv, token: string, issuer: string) {
  return Effect.gen(function* () {
    const { publicKey } = yield* keys(env);
    return yield* Effect.tryPromise(() => jwtVerify(token, publicKey, { issuer, algorithms: [ALG] })).pipe(
      Effect.map(({ payload }) => payload),
      Effect.catchCause(() => Effect.succeed(null)),
    );
  });
}

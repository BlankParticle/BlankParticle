import { join } from "node:path";

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Output from "alchemy/Output";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Jose from "jose";

const ROOT_DOMAIN = "blankparticle.com";

const AuthSchema = Drizzle.Schema("AuthSchema", {
  schema: join(import.meta.dirname, "src/db/schema.ts"),
  out: join(import.meta.dirname, "migrations"),
  dialect: "sqlite",
});

const AuthDatabase = Effect.flatMap(AuthSchema, (schema) =>
  Cloudflare.D1.Database("AuthDB", { name: "auth-db", migrations: schema }),
);

const SigningKeys = Effect.gen(function* () {
  const { publicKey, privateKey } = yield* Alchemy.KeyPair("AuthSigningKey", {
    algorithm: "ec",
    namedCurve: "P-256",
  });

  const jwks = publicKey.pipe(
    Output.mapEffect((pem) =>
      Effect.gen(function* () {
        const key = yield* Effect.tryPromise(() => Jose.importSPKI(pem, "ES256", { extractable: true }));
        const publicJwk = yield* Effect.tryPromise(() => Jose.exportJWK(key));
        const kid = yield* Effect.tryPromise(() => Jose.calculateJwkThumbprint(publicJwk));
        return { keys: [{ ...publicJwk, kid, alg: "ES256", use: "sig" }] };
      }).pipe(Effect.orDie),
    ),
  );

  return { privateKey, jwks };
});

const PairwiseSecret = Effect.map(Alchemy.Random("AuthPairwiseSecret", { bytes: 32 }), (secret) => secret.text);

export class AuthApp extends Cloudflare.Website.Vite<AuthApp>()("auth", {
  rootDir: import.meta.dirname,
  name: "auth",
  main: "src/api/worker.ts",
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    DB: AuthDatabase,
    GITHUB_CLIENT_ID: Config.string("GITHUB_CLIENT_ID"),
    GITHUB_CLIENT_SECRET: Config.redacted("GITHUB_CLIENT_SECRET"),
    SIGNING_KEY: SigningKeys.pipe(Effect.map((keys) => keys.privateKey)),
    JWKS: SigningKeys.pipe(Effect.map((keys) => keys.jwks)),
    PAIRWISE_SECRET: PairwiseSecret,
    ISSUER: Cloudflare.Worker.URL,
  },
  domain: { name: `auth.${ROOT_DOMAIN}` },
  workersDev: false,
  dev: { port: 9001 },
}) {}

export type AuthAppEnv = Cloudflare.InferEnv<typeof AuthApp>;

export const SetupAuthApp = AuthApp.pipe(RemovalPolicy.retain());

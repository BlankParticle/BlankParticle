import { join } from "node:path";

import { GithubClientId, GithubClientSecret } from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Namespace from "alchemy/Namespace";
import * as Output from "alchemy/Output";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import * as Effect from "effect/Effect";
import * as Jose from "jose";

const ROOT_DOMAIN = "blankparticle.com";

const Schema = Drizzle.Schema("Schema", {
  schema: join(import.meta.dirname, "src/db/schema.ts"),
  out: join(import.meta.dirname, "migrations"),
  dialect: "sqlite",
});

const DB = Effect.flatMap(Schema, (schema) => Cloudflare.D1.Database("DB", { name: "auth-db", migrations: schema }));

const SigningKeys = Effect.gen(function* () {
  const { publicKey, privateKey } = yield* Alchemy.KeyPair("SigningKey", {
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

const PairwiseSecret = Effect.map(Alchemy.Random("PairwiseSecret", { bytes: 32 }), (secret) => secret.text);

export class AuthApp extends Cloudflare.Website.Vite<AuthApp>()("Worker", {
  rootDir: import.meta.dirname,
  name: "auth",
  main: "src/api/worker.ts",
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    DB: DB,
    GITHUB_CLIENT_ID: GithubClientId,
    GITHUB_CLIENT_SECRET: GithubClientSecret,
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

export const SetupAuthApp = AuthApp.pipe(RemovalPolicy.retain(), Namespace.push("Auth"));

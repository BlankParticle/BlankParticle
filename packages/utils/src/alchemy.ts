import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class StageInvariantError extends Data.TaggedError("StageInvariantError")<{
  readonly message: string;
  readonly stage: string;
  readonly parseError: Schema.SchemaError;
}> {}

export const StageInvariant = Effect.fn(function* <S extends Schema.Constraint>(schema: S) {
  const { stage } = yield* Alchemy.Stack;
  yield* Schema.decodeUnknownEffect(schema)(stage, { errors: "all" }).pipe(
    Effect.mapError(
      (parseError) =>
        new StageInvariantError({
          message: `Stage "${stage}" is not allowed, ${parseError.message}`,
          stage,
          parseError,
        }),
    ),
  );
});

export const CloudflareAccountId = Effect.map(Effect.flatten(Cloudflare.CloudflareEnvironment), (env) => env.accountId);
export const CloudflareAccountEmail = Config.redacted("CLOUDFLARE_ACCOUNT_EMAIL");

export const GithubClientId = Config.string("GITHUB_CLIENT_ID");
export const GithubClientSecret = Config.redacted("GITHUB_CLIENT_SECRET");

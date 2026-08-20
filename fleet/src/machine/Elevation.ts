import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import type * as Terminal from "effect/Terminal";
import * as Prompt from "effect/unstable/cli/Prompt";

import { Command, type Options, type Result } from "./Command.ts";
import { type CommandFailure, SudoAuthenticationError, SudoUnavailableError } from "./Errors.ts";

export interface ElevationSession {
  readonly run: (argv: readonly [string, ...string[]], options?: Options) => Effect.Effect<Result, CommandFailure>;
  readonly runWithSudoAccess: (
    argv: readonly [string, ...string[]],
    options?: Options,
  ) => Effect.Effect<Result, CommandFailure>;
  readonly runWithSudoCommand: (
    argv: (sudo: string) => readonly [string, ...string[]],
    options?: Options,
  ) => Effect.Effect<Result, CommandFailure>;
}

export type ElevationSetupError = CommandFailure | SudoAuthenticationError | SudoUnavailableError | Terminal.QuitError;

export class Elevation extends Context.Service<
  Elevation,
  { readonly setup: Effect.Effect<ElevationSession, ElevationSetupError> }
>()("Fleet/Elevation") {}

const makeElevation = Effect.gen(function* () {
  const command = yield* Command;
  const setup = yield* Effect.cached(
    Effect.gen(function* () {
      const userId = Number.parseInt((yield* command.run(["id", "-u"])).output.trim(), 10);
      const strategy =
        userId === 0
          ? ({ type: "root" } as const)
          : (yield* command.run(["/bin/sh", "-c", "command -v sudo"], { allowFailure: true })).exitCode !== 0
            ? yield* Effect.fail(new SudoUnavailableError({ userId }))
            : (yield* command.run(["sudo", "-n", "true"], { allowFailure: true })).exitCode === 0
              ? ({ type: "passwordless" } as const)
              : yield* Effect.gen(function* () {
                  const password = yield* Prompt.run(
                    Prompt.password({ message: "Sudo password for the managed machine" }),
                  ).pipe(Effect.provide(NodeServices.layer));
                  const validation = yield* command.run(["sudo", "-S", "-p", "", "-v"], {
                    allowFailure: true,
                    input: `${Redacted.value(password)}\n`,
                  });
                  if (validation.exitCode !== 0) return yield* Effect.fail(new SudoAuthenticationError());
                  return { type: "password", password } as const;
                });

      const withPasswordFiles = Effect.fn(function* <A, E, R>(
        passwordValue: Redacted.Redacted,
        use: (files: { readonly askpass: string; readonly sudo: string }) => Effect.Effect<A, E, R>,
      ) {
        const directory = (yield* command.run(["mktemp", "-d", "-t", "fleet-sudo.XXXXXX"])).output.trim();
        const askpass = `${directory}/askpass`;
        const password = `${directory}/password`;
        const sudo = `${directory}/sudo`;

        return yield* Effect.gen(function* () {
          yield* command.run(["/bin/sh", "-c", 'umask 077; cat > "$1"', "fleet", password], {
            input: `${Redacted.value(passwordValue)}\n`,
          });
          yield* Effect.all(
            [
              command.run(["/bin/sh", "-c", 'umask 077; cat > "$1"; chmod 700 "$1"', "fleet", askpass], {
                input: '#!/bin/sh\nexec cat "$(dirname "$0")/password"\n',
              }),
              command.run(["/bin/sh", "-c", 'umask 077; cat > "$1"; chmod 700 "$1"', "fleet", sudo], {
                input: '#!/bin/sh\nexec sudo -S -p "" "$@" < "$(dirname "$0")/password"\n',
              }),
            ],
            { concurrency: 2 },
          );
          return yield* use({ askpass, sudo });
        }).pipe(
          Effect.ensuring(
            Effect.all(
              [
                command.run(["rm", "-f", "--", askpass, password, sudo], { allowFailure: true }),
                command.run(["rmdir", "--", directory], { allowFailure: true }),
              ],
              { concurrency: 1, discard: true },
            ).pipe(Effect.ignore),
          ),
        );
      });

      return {
        run: Effect.fn(function* (argv: readonly [string, ...string[]], options: Options = {}) {
          if (strategy.type === "root") return yield* command.run(argv, options);
          if (strategy.type === "passwordless") return yield* command.run(["sudo", "-n", "--", ...argv], options);
          return yield* command.run(["sudo", "-S", "-p", "", "--", ...argv], {
            ...options,
            input: `${Redacted.value(strategy.password)}\n${options.input ?? ""}`,
          });
        }),
        runWithSudoAccess: Effect.fn(function* (argv: readonly [string, ...string[]], options: Options = {}) {
          if (strategy.type !== "password") return yield* command.run(argv, options);
          return yield* withPasswordFiles(strategy.password, ({ askpass }) =>
            command.run(argv, {
              ...options,
              env: { ...options.env, SUDO_ASKPASS: askpass },
            }),
          );
        }),
        runWithSudoCommand: Effect.fn(function* (
          argv: (sudo: string) => readonly [string, ...string[]],
          options: Options = {},
        ) {
          if (strategy.type === "root") return yield* command.run(argv("/usr/bin/env"), options);
          if (strategy.type === "passwordless") return yield* command.run(argv("sudo"), options);
          return yield* withPasswordFiles(strategy.password, ({ sudo }) => command.run(argv(sudo), options));
        }),
      } satisfies ElevationSession;
    }),
  );
  return Elevation.of({ setup });
});

/** Default sudo-based implementation used by the built-in backends. */
export const SudoElevationLayer = Layer.effect(Elevation, makeElevation);

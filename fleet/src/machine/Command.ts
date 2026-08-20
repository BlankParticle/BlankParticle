import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { CommandError, type CommandFailure } from "./Errors.ts";

export interface Result {
  readonly exitCode: number;
  readonly output: string;
}

export interface Options {
  readonly allowFailure?: boolean;
  readonly env?: Record<string, string>;
  readonly input?: string;
}

const check = (argv: readonly string[], result: Result, allowFailure = false) =>
  Effect.filterOrFail(
    Effect.succeed(result),
    (result) => allowFailure || result.exitCode === 0,
    (result) => new CommandError({ command: argv, exitCode: result.exitCode, output: result.output }),
  );

/** Commands executed on the selected machine backend. */
export class Command extends Context.Service<
  Command,
  {
    readonly run: (argv: readonly [string, ...string[]], options?: Options) => Effect.Effect<Result, CommandFailure>;
  }
>()("Fleet/Command") {}

/** Processes on the controller. SSH backends use this to invoke ssh/scp. */
export class LocalProcess extends Context.Service<LocalProcess, Context.Service.Shape<typeof Command>>()(
  "Fleet/LocalProcess",
) {
  static readonly layer = Layer.effect(
    LocalProcess,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const semaphore = yield* Semaphore.make(1);

      const run = (argv: readonly [string, ...string[]], options: Options = {}) =>
        semaphore.withPermit(
          Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* spawner.spawn(
                ChildProcess.make(argv[0], argv.slice(1), {
                  env: options.env,
                  extendEnv: true,
                  stdin:
                    options.input === undefined ? "ignore" : Stream.succeed(new TextEncoder().encode(options.input)),
                  stdout: "pipe",
                  stderr: "pipe",
                }),
              );
              const [exitCode, output] = yield* Effect.all([
                handle.exitCode,
                Stream.mkString(Stream.decodeText(handle.all)),
              ]);
              return yield* check(argv, { exitCode: Number(exitCode), output }, options.allowFailure);
            }),
          ),
        );

      return LocalProcess.of({ run });
    }),
  );
}

export const LocalCommand = Layer.effect(
  Command,
  Effect.gen(function* () {
    const process = yield* LocalProcess;
    return Command.of(process);
  }),
);

const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

export const SshCommand = (host: string) =>
  Layer.effect(
    Command,
    Effect.gen(function* () {
      const process = yield* LocalProcess;
      const run = (argv: readonly [string, ...string[]], options: Options = {}) => {
        const environment = Object.entries(options.env ?? {}).flatMap(([key, value]) => [`${key}=${value}`]);
        const remote = [...(environment.length === 0 ? [] : ["env", ...environment]), ...argv]
          .map(shellQuote)
          .join(" ");
        return process
          .run(["ssh", "-o", "BatchMode=yes", host, "--", remote], {
            allowFailure: true,
            input: options.input,
          })
          .pipe(Effect.flatMap((result) => check(argv, result, options.allowFailure)));
      };
      return Command.of({ run });
    }),
  );

export const capture = Effect.fn(function* (argv: readonly [string, ...string[]]) {
  const command = yield* Command;
  return yield* command.run(argv, { allowFailure: true });
});

export const sh = (argv: readonly [string, ...string[]], options?: Options) =>
  Effect.gen(function* () {
    const command = yield* Command;
    yield* command.run(argv, options);
  });

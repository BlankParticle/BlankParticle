import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Stream from "effect/Stream";

/** A failure the user can act on; printed as a plain message, no stack trace. */
export class UserError extends Data.TaggedError("UserError")<{ readonly message: string }> {}

export const fail = (message: string) => Effect.fail(new UserError({ message }));

/**
 * Runs a local command with stdout piped and returns the exit code with trimmed stdout and stderr.
 * Both pipes are drained concurrently with the exit, so a chatty command can't fill a pipe and stall;
 * `stderr: "inherit"` passes it through to the terminal instead (and `stderr` comes back empty).
 */
export const run = (command: string, args: string[], options: { stderr?: "pipe" | "inherit" } = {}) =>
  Effect.scoped(
    Effect.gen(function* () {
      const stderr = options.stderr ?? "pipe";
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(ChildProcess.make(command, args, { stdout: "pipe", stderr }));
      const [exitCode, stdoutText, stderrText] = yield* Effect.all(
        [
          handle.exitCode,
          Stream.mkString(Stream.decodeText(handle.stdout)),
          stderr === "pipe" ? Stream.mkString(Stream.decodeText(handle.stderr)) : Effect.succeed(""),
        ],
        { concurrency: "unbounded" },
      );
      return { exitCode: Number(exitCode), stdout: stdoutText.trim(), stderr: stderrText.trim() };
    }),
  ).pipe(Effect.mapError((cause) => new UserError({ message: `could not run ${command}: ${cause}` })));

/** Runs a local command and returns its trimmed stdout, or null if it fails for any reason. */
export const capture = (command: string, args: string[], options: { stderr?: "pipe" | "inherit" } = {}) =>
  run(command, args, options).pipe(
    Effect.map(({ exitCode, stdout }) => (exitCode === 0 ? stdout : null)),
    Effect.catch(() => Effect.succeed(null)),
  );

/** Runs a local command with the terminal attached and returns its exit code. */
export const exec = (command: string, args: string[]) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, args, { stdin: "inherit", stdout: "inherit", stderr: "inherit" }),
      );
      return Number(yield* handle.exitCode);
    }),
  ).pipe(Effect.mapError((cause) => new UserError({ message: `could not run ${command}: ${cause}` })));

import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Stream from "effect/Stream";

/** A failure the user can act on; printed as a plain message, no stack trace. */
export class UserError extends Data.TaggedError("UserError")<{ readonly message: string }> {}

/** Runs a local command and returns its trimmed stdout, or null if it fails for any reason. */
export const capture = (command: string, args: string[], options: { stderr?: "pipe" | "inherit" } = {}) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, args, { stdout: "pipe", stderr: options.stderr ?? "pipe" }),
      );
      const [exitCode, stdout] = yield* Effect.all([
        handle.exitCode,
        Stream.mkString(Stream.decodeText(handle.stdout)),
      ]);
      return Number(exitCode) === 0 ? stdout.trim() : null;
    }),
  ).pipe(Effect.catch(() => Effect.succeed(null)));

/** Runs a local command with its output piped and returns the exit code with trimmed stdout and stderr. */
export const run = (command: string, args: string[]) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(ChildProcess.make(command, args, { stdout: "pipe", stderr: "pipe" }));
      const [exitCode, stdout, stderr] = yield* Effect.all(
        [
          handle.exitCode,
          Stream.mkString(Stream.decodeText(handle.stdout)),
          Stream.mkString(Stream.decodeText(handle.stderr)),
        ],
        { concurrency: "unbounded" },
      );
      return { exitCode: Number(exitCode), stdout: stdout.trim(), stderr: stderr.trim() };
    }),
  ).pipe(Effect.mapError((cause) => new UserError({ message: `could not run ${command}: ${cause}` })));

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

import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import { Command, LocalProcess } from "./Command.ts";
import { HomeDirectoryError, type FileSystemFailure } from "./Errors.ts";

export type EntryType = "File" | "Directory" | "Other";

export interface MachineFileSystemService {
  readonly home: string;
  readonly exists: (path: string) => Effect.Effect<boolean, FileSystemFailure>;
  readonly type: (path: string) => Effect.Effect<EntryType | undefined, FileSystemFailure>;
  readonly mode: (path: string) => Effect.Effect<number | undefined, FileSystemFailure>;
  readonly readDirectory: (path: string) => Effect.Effect<string[], FileSystemFailure>;
  readonly readFile: (path: string) => Effect.Effect<Uint8Array, FileSystemFailure>;
  readonly remove: (path: string) => Effect.Effect<void, FileSystemFailure>;
  readonly makeDirectory: (path: string) => Effect.Effect<void, FileSystemFailure>;
  readonly copyFromLocal: (source: string, target: string) => Effect.Effect<void, FileSystemFailure>;
  readonly writeFileString: (path: string, content: string) => Effect.Effect<void, FileSystemFailure>;
  readonly chmod: (path: string, mode: number) => Effect.Effect<void, FileSystemFailure>;
}

export class MachineFileSystem extends Context.Service<MachineFileSystem, MachineFileSystemService>()(
  "Fleet/FileSystem",
) {}

export const LocalFileSystem = Layer.effect(
  MachineFileSystem,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const home = yield* Config.string("HOME").pipe(Effect.orDie);
    const type = Effect.fn(function* (target: string) {
      if (!(yield* fs.exists(target))) return undefined;
      const info = yield* fs.stat(target);
      return info.type === "File" || info.type === "Directory" ? info.type : "Other";
    });
    return MachineFileSystem.of({
      home,
      exists: fs.exists,
      type,
      mode: (target) =>
        fs
          .exists(target)
          .pipe(
            Effect.flatMap((exists) =>
              exists ? fs.stat(target).pipe(Effect.map((info) => info.mode & 0o777)) : Effect.succeed(undefined),
            ),
          ),
      readDirectory: fs.readDirectory,
      readFile: fs.readFile,
      remove: (target) => fs.remove(target, { recursive: true, force: true }),
      makeDirectory: (target) => fs.makeDirectory(target, { recursive: true }),
      copyFromLocal: (source, target) => fs.copy(source, target, { overwrite: true }),
      writeFileString: fs.writeFileString,
      chmod: fs.chmod,
    });
  }),
);

export const SshFileSystem = (host: string) =>
  Layer.effect(
    MachineFileSystem,
    Effect.gen(function* () {
      const command = yield* Command;
      const process = yield* LocalProcess;
      const localFs = yield* FileSystem.FileSystem;
      const home = (yield* command.run(["printenv", "HOME"])).output.trim();
      if (home.length === 0) return yield* Effect.fail(new HomeDirectoryError({ host }));

      const succeeds = Effect.fn(function* (argv: readonly [string, ...string[]]) {
        return (yield* command.run(argv, { allowFailure: true })).exitCode === 0;
      });
      const type = Effect.fn(function* (target: string) {
        if (yield* succeeds(["test", "-L", target])) return "Other" as const;
        if (yield* succeeds(["test", "-f", target])) return "File" as const;
        if (yield* succeeds(["test", "-d", target])) return "Directory" as const;
        return undefined;
      });

      return MachineFileSystem.of({
        home,
        exists: (target) => succeeds(["test", "-e", target]),
        type,
        mode: (target) =>
          command
            .run(["stat", "-c", "%a", target], { allowFailure: true })
            .pipe(
              Effect.map(({ exitCode, output }) => (exitCode === 0 ? Number.parseInt(output.trim(), 8) : undefined)),
            ),
        readDirectory: (target) =>
          command
            .run(["find", target, "-mindepth", "1", "-maxdepth", "1", "-printf", "%f\\n"])
            .pipe(Effect.map(({ output }) => output.split("\n").filter(Boolean))),
        readFile: (target) =>
          command
            .run(["base64", target])
            .pipe(Effect.flatMap(({ output }) => Effect.fromResult(Encoding.decodeBase64(output)).pipe(Effect.orDie))),
        remove: (target) => command.run(["rm", "-rf", "--", target]).pipe(Effect.asVoid),
        makeDirectory: (target) => command.run(["mkdir", "-p", "--", target]).pipe(Effect.asVoid),
        copyFromLocal: Effect.fn(function* (source: string, target: string) {
          const sourceInfo = yield* localFs.stat(source);
          if (sourceInfo.type === "Directory") {
            yield* process.run(["scp", "-q", "-r", "-o", "BatchMode=yes", source, `${host}:${target}`]);
          } else {
            yield* process.run(["scp", "-q", "-o", "BatchMode=yes", source, `${host}:${target}`]);
          }
        }),
        writeFileString: (target, content) =>
          command.run(["/bin/sh", "-c", 'cat > "$1"', "fleet", target], { input: content }).pipe(Effect.asVoid),
        chmod: (target, mode) => command.run(["chmod", mode.toString(8), "--", target]).pipe(Effect.asVoid),
      });
    }),
  );

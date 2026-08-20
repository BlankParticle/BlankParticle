import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import type { ContentSource } from "../content.ts";
import { type FileSystemFailure, ManifestSourceError } from "./Errors.ts";
import { MachineFileSystem } from "./FileSystem.ts";

export type ManagedPathProps =
  | { readonly target: string; readonly content: string; readonly source?: never; readonly mode?: number }
  | { readonly target: string; readonly source: ContentSource; readonly content?: never; readonly mode?: number };

export class ManagedPath extends Context.Service<
  ManagedPath,
  {
    readonly converged: (props: ManagedPathProps) => Effect.Effect<boolean, FileSystemFailure | ManifestSourceError>;
    readonly write: (
      props: ManagedPathProps,
    ) => Effect.Effect<{ readonly path: string }, FileSystemFailure | ManifestSourceError>;
    readonly remove: (path: string) => Effect.Effect<void, FileSystemFailure>;
    readonly exists: (path: string) => Effect.Effect<boolean, FileSystemFailure>;
    readonly resolve: (target: string) => string;
  }
>()("Fleet/ManagedPath") {}

export const ManagedPathLayer = Layer.effect(
  ManagedPath,
  Effect.gen(function* () {
    const local = yield* FileSystem.FileSystem;
    const machine = yield* MachineFileSystem;
    const path = yield* Path.Path;
    const repoRoot = path.resolve(import.meta.dirname, "../..");
    const resolve = (target: string) => path.join(machine.home, target);

    const contentEquals = Effect.fn(function* (source: string, target: string) {
      const pending: Array<readonly [source: string, target: string]> = [[source, target]];
      while (pending.length > 0) {
        const [currentSource, currentTarget] = pending.pop()!;
        const targetInfo = yield* machine.type(currentTarget);
        if (!targetInfo) return false;
        const sourceInfo = yield* local.stat(currentSource);
        if (sourceInfo.type === "Directory") {
          if (targetInfo !== "Directory") return false;
          const [sourceEntries, targetEntries] = yield* Effect.all([
            local.readDirectory(currentSource),
            machine.readDirectory(currentTarget),
          ]);
          sourceEntries.sort();
          targetEntries.sort();
          if (sourceEntries.join("\n") !== targetEntries.join("\n")) return false;
          pending.push(
            ...sourceEntries.map((name) => [path.join(currentSource, name), path.join(currentTarget, name)] as const),
          );
          continue;
        }
        if (sourceInfo.type !== "File" || targetInfo !== "File") return false;
        const [sourceBytes, targetBytes] = yield* Effect.all([
          local.readFile(currentSource),
          machine.readFile(currentTarget),
        ]);
        if (
          sourceBytes.length !== targetBytes.length ||
          !sourceBytes.every((byte, index) => byte === targetBytes[index])
        )
          return false;
      }
      return true;
    });

    const converged = Effect.fn(function* (props: ManagedPathProps) {
      const target = resolve(props.target);
      const targetType = yield* machine.type(target);
      if (!targetType) return false;
      if (props.mode !== undefined && (yield* machine.mode(target)) !== props.mode) return false;
      if (props.target.startsWith(".ssh/") && (yield* machine.mode(resolve(".ssh"))) !== 0o700) return false;
      if (props.source?._tag === "File") {
        const source = path.join(repoRoot, props.source.path);
        if (!(yield* local.exists(source)))
          return yield* Effect.fail(new ManifestSourceError({ source: props.source.path }));
        return yield* contentEquals(source, target);
      }
      const content = props.source?._tag === "Inline" ? props.source.content : props.content;
      return targetType === "File" && new TextDecoder().decode(yield* machine.readFile(target)) === content;
    });

    return ManagedPath.of({
      converged,
      resolve,
      exists: machine.exists,
      remove: machine.remove,
      write: Effect.fn(function* (props) {
        const target = resolve(props.target);
        if (!(yield* converged(props))) {
          yield* machine.remove(target);
          yield* machine.makeDirectory(path.dirname(target));
          if (props.content !== undefined) yield* machine.writeFileString(target, props.content);
          else if (props.source._tag === "Inline") yield* machine.writeFileString(target, props.source.content);
          else yield* machine.copyFromLocal(path.join(repoRoot, props.source.path), target);
        }
        if (props.mode !== undefined) yield* machine.chmod(target, props.mode);
        if (props.target.startsWith(".ssh/")) yield* machine.chmod(resolve(".ssh"), 0o700);
        return { path: target };
      }),
    });
  }),
);

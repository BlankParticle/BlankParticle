import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { lookup as lookupMime } from "mrmime";

/** Turning what the shell hands us into a flat list of files to upload. Shared by `site upload` and `file upload`. */

export type Source = { relative: string; absolute: string; size: number };

/** How many files upload or download at once */
export const TRANSFER_CONCURRENCY = 8;

export const contentType = (file: string) => lookupMime(file) ?? "application/octet-stream";

const isIgnored = (relative: string) =>
  relative.split("/").some((segment) => segment.startsWith(".") || segment === "node_modules");

/** A lone `.html`/`.md` becomes the site root; any other single file keeps its name */
const singleFileName = (path: Path.Path, absolute: string) => {
  const extension = path.extname(absolute).toLowerCase();
  if (extension === ".html" || extension === ".htm") return "index.html";
  if (extension === ".md" || extension === ".markdown") return "index.md";
  return path.basename(absolute);
};

/** Collect the files to publish: a directory (recursively) or a single file */
export const collectFiles = (source: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = path.resolve(source);
    const info = yield* fs.stat(root);
    if (info.type !== "Directory")
      return [{ relative: singleFileName(path, root), absolute: root, size: Number(info.size) }];

    const entries = yield* fs.readDirectory(root, { recursive: true });
    return yield* Effect.forEach(
      entries,
      (entry) =>
        Effect.gen(function* () {
          const absolute = path.isAbsolute(entry) ? entry : path.join(root, entry);
          const relative = path.relative(root, absolute).split(path.sep).join("/");
          if (isIgnored(relative)) return [];
          const stat = yield* fs.stat(absolute);
          return stat.type === "File" ? [{ relative, absolute, size: Number(stat.size) }] : [];
        }),
      { concurrency: 16 },
    ).pipe(Effect.map((groups) => groups.flat()));
  });

/**
 * Several sources at once: directories contribute their contents (relative to themselves),
 * single files keep their name. Later entries win when relative names collide.
 */
export const collectSources = (sources: ReadonlyArray<string>) =>
  Effect.map(
    Effect.forEach(sources, (source) => collectFiles(source)),
    (lists) => [...new Map(lists.flat().map((file) => [file.relative, file])).values()],
  );

/**
 * Streams `bytes` to `relative` under `dest`, creating folders as needed. A path that would escape `dest` is skipped
 * with a warning; returns whether the file was written.
 */
export const writeInto = <E>(dest: string, relative: string, bytes: Stream.Stream<Uint8Array, E>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const target = path.resolve(dest, relative);
    if (!target.startsWith(path.resolve(dest) + path.sep)) {
      yield* Console.warn(`! skipped ${relative}: it would land outside ${dest}`);
      return false;
    }
    yield* fs.makeDirectory(path.dirname(target), { recursive: true });
    yield* Stream.run(bytes, fs.sink(target));
    return true;
  });

/** Streams `bytes` to `target`, creating folders as needed */
export const writeFile = <E>(target: string, bytes: Stream.Stream<Uint8Array, E>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.dirname(path.resolve(target)), { recursive: true });
    yield* Stream.run(bytes, fs.sink(target));
  });

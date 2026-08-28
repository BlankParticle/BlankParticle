import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

/** Turning what the shell hands us into a flat list of files to upload. Shared by `site upload` and `file upload`. */

export type Source = { relative: string; absolute: string; size: number };

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

/** Writes `relative` under `dest`, creating folders as needed; refuses paths that would escape `dest` */
export const writeInto = (dest: string, relative: string, bytes: Uint8Array) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const target = path.resolve(dest, relative);
    if (!target.startsWith(path.resolve(dest) + path.sep)) return;
    yield* fs.makeDirectory(path.dirname(target), { recursive: true });
    yield* fs.writeFile(target, bytes);
  });

/** Writes one file at `target`, creating folders as needed */
export const writeFile = (target: string, bytes: Uint8Array) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.dirname(path.resolve(target)), { recursive: true });
    yield* fs.writeFile(target, bytes);
  });

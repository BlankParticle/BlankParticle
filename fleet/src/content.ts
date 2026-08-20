import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { ManifestSourceError } from "./machine/Errors.ts";

export interface InlineSource {
  readonly _tag: "Inline";
  readonly content: string;
  readonly filename?: string;
}

export interface FileSource {
  readonly _tag: "File";
  readonly path: string;
  readonly filename: string;
}

export type ContentSource = InlineSource | FileSource;

export interface Content {
  readonly source: ContentSource;
}

type SourceTag = (strings: TemplateStringsArray, ...values: readonly unknown[]) => Effect.Effect<InlineSource>;

const render = (strings: TemplateStringsArray, values: readonly unknown[]) => {
  let text = strings[0];
  values.forEach((value, index) => (text += String(value) + strings[index + 1]));
  const lines = text.split("\n");
  if (lines[0]?.trim() === "") lines.shift();
  while (lines.length && lines.at(-1)!.trim() === "") lines.pop();
  const indentation = Math.min(...lines.filter((line) => line.trim()).map((line) => /^[ \t]*/.exec(line)![0].length));
  return lines.map((line) => line.slice(indentation)).join("\n") + "\n";
};

/** Dedent inline content, optionally carrying its destination filename. */
export function source(strings: TemplateStringsArray, ...values: readonly unknown[]): Effect.Effect<InlineSource>;
export function source(filename: string): SourceTag;
export function source(
  first: string | TemplateStringsArray,
  ...values: readonly unknown[]
): Effect.Effect<InlineSource> | SourceTag {
  if (typeof first === "string") {
    return (strings, ...values) =>
      Effect.sync(() => ({ _tag: "Inline", content: render(strings, values), filename: first }));
  }
  return Effect.sync(() => ({ _tag: "Inline", content: render(first, values) }));
}

/** Use a repository-relative file as content. */
export const file = Effect.fn("Fleet.Content.file")(function* (path: string) {
  return { _tag: "File", path, filename: path.split("/").at(-1)! } satisfies FileSource;
});

/** Resolve a source and replace its {{key}} placeholders. */
export const template = Effect.fn("Fleet.Content.template")(function* <Error, Requirements>(
  input: Effect.Effect<ContentSource, Error, Requirements>,
  values: Readonly<Record<string, string>>,
) {
  const source = yield* input;
  const content =
    source._tag === "Inline"
      ? source.content
      : yield* Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const target = path.resolve(import.meta.dirname, "..", source.path);
          if (!(yield* fileSystem.exists(target)))
            return yield* Effect.fail(new ManifestSourceError({ source: source.path }));
          return yield* fileSystem.readFileString(target);
        });
  return {
    _tag: "Inline",
    filename: source.filename,
    content: Object.entries(values).reduce((content, [key, value]) => content.replaceAll(`{{${key}}}`, value), content),
  } satisfies InlineSource;
});

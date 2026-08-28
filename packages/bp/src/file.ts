import { createHash } from "node:crypto";

import { DEFAULT_FILE_TTL_SECONDS, isBundleId, MAX_FILE_BYTES, MiB } from "@blankparticle/tools/spec";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { lookup as lookupMime } from "mrmime";

import { call, client, download, fail, shared } from "./client.ts";
import { collectSources, writeFile, writeInto } from "./sources.ts";

/** `--expires "7 days"` (Effect duration syntax), `3d`/`12h`/`30m` shorthands, or `never` */
const parseExpiry = (input: string): Effect.Effect<number | "never", never> | null => {
  const text = input.trim().toLowerCase();
  if (text === "never" || text === "infinity") return Effect.succeed("never");
  const shorthand = text.match(/^(\d+(?:\.\d+)?)\s*([smhdw])$/);
  const unit = { s: "seconds", m: "minutes", h: "hours", d: "days", w: "weeks" } as const;
  const normalized = shorthand ? `${shorthand[1]} ${unit[shorthand[2] as keyof typeof unit]}` : text;
  const duration = Duration.fromInput(normalized as Duration.Input);
  if (Option.isNone(duration) || !Duration.isFinite(duration.value)) return null;
  const seconds = Math.round(Duration.toSeconds(duration.value));
  return seconds > 0 ? Effect.succeed(seconds) : null;
};

const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const formatExpiry = (expiresAt: number | null) =>
  expiresAt === null
    ? "never expires"
    : `expires ${new Date(expiresAt).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const upload = Command.make(
  "upload",
  {
    ...shared,
    sources: Argument.path("source", { mustExist: true }).pipe(
      Argument.withDescription("Files or directories to upload; everything lands under one id, paths kept"),
      Argument.atLeast(1),
    ),
    expires: Flag.string("expires").pipe(
      Flag.withAlias("e"),
      Flag.withDefault(`${DEFAULT_FILE_TTL_SECONDS / 86400} days`),
      Flag.withDescription('Lifetime: "7 days", "12 hours", 3d, 30m, or never'),
    ),
    name: Flag.optional(Flag.string("name")).pipe(
      Flag.withDescription("Name to store under when uploading a single file (default: the file name)"),
    ),
    private: Flag.boolean("private").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Only the owner can view (requires a signed-in browser session)"),
    ),
  },
  (options) =>
    Effect.gen(function* () {
      const ttl = parseExpiry(options.expires);
      if (ttl === null)
        return yield* fail(`can't parse "${options.expires}" as a duration (try "7 days", 12h, or never)`);
      const seconds = yield* ttl;

      const fs = yield* FileSystem.FileSystem;
      const files = yield* collectSources(options.sources);
      if (files.length === 0) return yield* fail("nothing to upload");
      if (Option.isSome(options.name) && files.length > 1) return yield* fail("--name only applies to a single file");
      const oversized = files.filter((file) => file.size > MAX_FILE_BYTES);
      if (oversized.length > 0)
        return yield* fail(
          `larger than ${MiB(MAX_FILE_BYTES)}, the most one upload can carry:\n${oversized.map((file) => `  ${file.relative} (${MiB(file.size)})`).join("\n")}`,
        );

      // Manifest first: read + hash everything, tell the server, and it mints the id and tells us what it still needs
      const entries = yield* Effect.forEach(files, (file) =>
        Effect.map(fs.readFile(file.absolute), (bytes) => ({
          name: files.length === 1 ? Option.getOrElse(options.name, () => file.relative) : file.relative,
          // Node's readFile is ArrayBuffer-backed; TS only knows it as ArrayBufferLike
          bytes: bytes as Uint8Array<ArrayBuffer>,
          type: lookupMime(file.relative) ?? "application/octet-stream",
          hash: createHash("sha256").update(bytes).digest("hex"),
        })),
      );
      const api = yield* client(options);
      const manifest = yield* call(() =>
        api.api.files.manifest.$post({
          json: {
            files: entries.map(({ name, bytes, type, hash }) => ({ name, size: bytes.byteLength, type, hash })),
            ttl: seconds === "never" ? "never" : String(seconds),
            visibility: options.private ? "private" : "public",
          },
        }),
      );
      const pending = new Set(manifest.files.filter((file) => !file.uploaded).map((file) => file.name));
      let last: { url: string; visibility: string; expiresAt: number | null } | undefined;
      for (const entry of entries) {
        if (!pending.has(entry.name)) {
          yield* Console.log(`= ${entry.name} (already there)`);
          continue;
        }
        const record = yield* call(() =>
          api.api.files[":id"].upload.$put(
            { param: { id: manifest.id }, query: { name: entry.name } },
            { headers: { "content-type": entry.type }, init: { body: entry.bytes } },
          ),
        );
        last = record;
        yield* Console.log(`↑ ${record.name} (${formatBytes(record.size)})  ${record.url}`);
      }
      const summary =
        last === undefined ? "nothing new to upload" : `${last.visibility}, ${formatExpiry(last.expiresAt)}`;
      yield* Console.log(
        `\n✔ ${entries.length === 1 && last !== undefined ? last.url : `${entries.length} file${entries.length === 1 ? "" : "s"} under ${manifest.url}`} (${summary})`,
      );
    }),
).pipe(Command.withDescription("Upload files (or whole folders) and get links back"));

const ls = Command.make("ls", shared, (options) =>
  Effect.gen(function* () {
    const api = yield* client(options);
    const records = yield* call(() => api.api.files.$get());
    if (records.length === 0) return yield* Console.log("no files");
    for (const record of records) {
      yield* Console.log(
        `${record.id}  ${record.visibility.padEnd(7)}  ${formatBytes(record.size).padStart(9)}  ${formatExpiry(record.expiresAt).padEnd(32)}  ${record.url}`,
      );
    }
  }),
).pipe(Command.withDescription("List your files"));

const rm = Command.make(
  "rm",
  {
    ...shared,
    id: Argument.string("id").pipe(
      Argument.withDescription(
        "Share id (first path segment of the URL, `b-…` for bundles); removes everything under it",
      ),
    ),
  },
  (options) =>
    Effect.gen(function* () {
      const api = yield* client(options);
      yield* call(() => api.api.files[":id"].$delete({ param: { id: options.id } }));
      yield* Console.log(`✔ deleted ${options.id}`);
    }),
).pipe(Command.withDescription("Delete a file or a whole bundle"));

/** Pull a share down: a single file to a path, a bundle into a folder */
const fileDownload = Command.make(
  "download",
  {
    ...shared,
    id: Argument.string("id").pipe(Argument.withDescription("Share id (first path segment of the URL)")),
    dest: Argument.optional(Argument.path("dest")).pipe(
      Argument.withDescription("File path for a single file, folder for a bundle (default: the file name / ./<id>)"),
    ),
  },
  (options) =>
    Effect.gen(function* () {
      const api = yield* client(options);
      const records = yield* call(() => api.api.files[":id"].$get({ param: { id: options.id } }));
      const bundle = isBundleId(options.id);
      const dest = Option.getOrElse(options.dest, () => (bundle ? options.id : (records[0]?.name ?? options.id)));
      for (const record of records) {
        const bytes = yield* download(() =>
          api.api.files[":id"].download.$get({ param: { id: options.id }, query: { name: record.name } }),
        );
        if (bundle) yield* writeInto(dest, record.name, bytes);
        else yield* writeFile(dest, bytes);
        yield* Console.log(`↓ ${record.name} (${formatBytes(record.size)})`);
      }
      yield* Console.log(`✔ ${records.length} file${records.length === 1 ? "" : "s"} → ${dest}${bundle ? "/" : ""}`);
    }),
).pipe(Command.withDescription("Download a file or a whole bundle (private ones too, when they are yours)"));

export const file = Command.make("file").pipe(
  Command.withDescription("Share files via files.blankparticle.com (7 day expiry by default)"),
  Command.withSubcommands([upload, ls, rm, fileDownload]),
);

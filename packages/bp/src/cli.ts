import { isValidSlug, MAX_SITE_FILE_BYTES, MiB, type Visibility } from "@blankparticle/tools/spec";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { lookup as lookupMime } from "mrmime";

import { call, client, download, fail, makeClient, shared, type Client } from "./client.ts";
import { clone } from "./clone.ts";
import { file } from "./file.ts";
import { login as oauthLogin } from "./oauth.ts";
import { UserError } from "./runtime.ts";
import { collectFiles, writeInto } from "./sources.ts";
import { randomSlug } from "./words.ts";

const UPLOAD_CONCURRENCY = 8;

const freshSlug = (api: Client) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = randomSlug();
      const response = yield* api.api.sites[":slug"]
        .$get({ param: { slug } })
        .pipe(Effect.mapError((cause) => new UserError({ message: `could not reach the server: ${cause}` })));
      if (response.status === 404) return slug;
    }
    return yield* fail("could not find a free slug, pass one with --slug");
  });

const contentType = (file: string) => lookupMime(file) ?? "application/octet-stream";

const formatBytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

const upload = Command.make(
  "upload",
  {
    ...shared,
    source: Argument.path("source", { mustExist: true }).pipe(
      Argument.withDescription("Directory (or a single .html / .md file) to publish"),
    ),
    slug: Flag.optional(Flag.string("slug").pipe(Flag.withAlias("s"))).pipe(
      Flag.withDescription("Site slug; a random three-word name when omitted"),
    ),
    private: Flag.boolean("private").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Only signed-in, allow-listed users can view"),
    ),
    public: Flag.boolean("public").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Anyone with the link can view (default for new sites)"),
    ),
  },
  (options) =>
    Effect.gen(function* () {
      if (Option.isSome(options.slug) && !isValidSlug(options.slug.value)) {
        return yield* fail(`invalid slug "${options.slug.value}": lowercase letters, digits and dashes only`);
      }
      const visibility: Visibility | undefined = options.private ? "private" : options.public ? "public" : undefined;

      const fs = yield* FileSystem.FileSystem;
      const files = yield* collectFiles(options.source);
      // KV can't hold a page over 25 MiB; say so before touching the server
      const oversized = files.filter((file) => file.size > MAX_SITE_FILE_BYTES);
      if (oversized.length > 0)
        return yield* fail(
          [
            `these are larger than ${MiB(MAX_SITE_FILE_BYTES)}, the most a site page can be:`,
            ...oversized.map((file) => `  ${file.relative} (${MiB(file.size)})`),
            "share them with `bp file upload <path>` instead, and link to the file URL from the site",
          ].join("\n"),
        );
      if (files.length === 0) return yield* fail("nothing to upload");

      const api = yield* client(options);
      const slug = Option.isSome(options.slug) ? options.slug.value : yield* freshSlug(api);
      const site = yield* call(() => api.api.sites[":slug"].$put({ param: { slug }, json: { visibility } }));
      yield* Console.log(`→ ${site.visibility} site ${site.url} · ${files.length} file(s)`);

      yield* Effect.forEach(
        files,
        (file) =>
          Effect.gen(function* () {
            // Node's readFile is ArrayBuffer-backed; TS only knows it as ArrayBufferLike
            const bytes = (yield* fs.readFile(file.absolute)) as Uint8Array<ArrayBuffer>;
            const type = contentType(file.absolute);
            const uploaded = yield* call(() =>
              api.api.sites[":slug"].files.$put(
                { param: { slug }, query: { path: file.relative, type } },
                { headers: { "content-type": type }, init: { body: bytes } },
              ),
            );
            yield* Console.log(`  ↑ ${uploaded.path} (${formatBytes(uploaded.size)})`);
          }),
        { concurrency: UPLOAD_CONCURRENCY, discard: true },
      );

      const { removed } = yield* call(() =>
        api.api.sites[":slug"].sync.$post({ param: { slug }, json: { keep: files.map((file) => file.relative) } }),
      );
      if (removed.length > 0) yield* Console.log(`  ✕ removed ${removed.length} stale file(s)`);

      yield* Console.log(`\n✔ ${site.url}`);
    }),
).pipe(
  Command.withShortDescription("Publish a folder of static files and get a link back"),
  Command.withDescription(
    [
      "Publish a folder of static files and get a link back.",
      "Markdown (.md) is rendered as GitHub-flavoured HTML: /notes serves notes.md, index.md or README.md serve a directory,",
      "and the raw source stays reachable at /notes.md. Root-absolute URLs in html/css/md are rewritten under the slug.",
    ].join("\n  "),
  ),
);

const ls = Command.make("ls", shared, (options) =>
  Effect.gen(function* () {
    const api = yield* client(options);
    const sites = yield* call(() => api.api.sites.$get());
    if (sites.length === 0) return yield* Console.log("no sites yet");
    for (const site of sites) {
      const when = new Date(site.updatedAt).toISOString().slice(0, 16).replace("T", " ");
      yield* Console.log(`${site.visibility.padEnd(8)} ${when}  ${site.url}`);
    }
  }),
).pipe(Command.withDescription("List your sites"));

const rm = Command.make(
  "rm",
  { ...shared, slug: Argument.string("slug").pipe(Argument.withDescription("Site to delete")) },
  (options) =>
    Effect.gen(function* () {
      const api = yield* client(options);
      yield* call(() => api.api.sites[":slug"].$delete({ param: { slug: options.slug } }));
      yield* Console.log(`✔ deleted ${options.slug}`);
    }),
).pipe(Command.withDescription("Delete a site and all of its files"));

const whoami = Command.make("whoami", shared, (options) =>
  Effect.gen(function* () {
    const api = yield* client(options);
    const user = yield* call(() => api.api.me.$get());
    yield* Console.log(`@${user.login} (${options.url})`);
  }),
).pipe(Command.withDescription("Show logged-in user and the tools API URL"));

const login = Command.make(
  "login",
  {
    ...shared,
    device: Flag.boolean("device")
      .pipe(Flag.withDescription("Show a code to approve in any browser instead of opening one here"))
      .pipe(Flag.optional),
  },
  (options) =>
    Effect.gen(function* () {
      const token = yield* oauthLogin(options.url, { device: options.device.valueOrUndefined ?? false });
      yield* Console.log("Verifying the authenticated identity with the tools API…");
      const api = makeClient(options.url, token);
      const user = yield* call(() => api.api.me.$get());
      yield* Console.log(`✔ signed in as @${user.login}`);
    }),
).pipe(Command.withDescription("Sign the CLI in through auth.blankparticle.com"));

/** Pull a site's files (yours, or anyone's public one) into a folder, exactly as stored */
const siteDownload = Command.make(
  "download",
  {
    ...shared,
    slug: Argument.string("slug").pipe(Argument.withDescription("Site to download")),
    dest: Argument.optional(Argument.path("dest")).pipe(
      Argument.withDescription("Folder to write into (default: ./<slug>)"),
    ),
  },
  (options) =>
    Effect.gen(function* () {
      const api = yield* client(options);
      const { files } = yield* call(() => api.api.sites[":slug"].$get({ param: { slug: options.slug } }));
      const dest = Option.getOrElse(options.dest, () => options.slug);
      for (const file of files) {
        const bytes = yield* download(() =>
          api.api.sites[":slug"].files.$get({ param: { slug: options.slug }, query: { path: file.path } }),
        );
        yield* writeInto(dest, file.path, bytes);
        yield* Console.log(`↓ ${file.path}`);
      }
      yield* Console.log(`✔ ${files.length} file${files.length === 1 ? "" : "s"} → ${dest}/`);
    }),
).pipe(Command.withDescription("Download a site's files into a folder (private ones too, when they are yours)"));

const site = Command.make("site").pipe(
  Command.withDescription("Publish static pages and markdown to sites.blankparticle.com"),
  Command.withSubcommands([upload, ls, rm, siteDownload]),
);

export const bp = Command.make("bp").pipe(
  Command.withDescription("blankparticle tools"),
  Command.withSubcommands([site, file, clone, login, whoami]),
);

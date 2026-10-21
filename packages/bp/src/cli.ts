import { isValidSlug, MAX_SITE_FILE_BYTES, MiB, type Visibility } from "@blankparticle/tools/spec";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { client, makeClient, shared, type Client } from "./client.ts";
import { clone } from "./clone.ts";
import { file } from "./file.ts";
import { formatBytes, formatUtc } from "./format.ts";
import { login as oauthLogin } from "./oauth.ts";
import { fail } from "./runtime.ts";
import { collectFiles, contentType, TRANSFER_CONCURRENCY, writeInto } from "./sources.ts";
import { randomSlug } from "./words.ts";

/** A generated slug must not land on an existing site (yours would be overwritten, someone else's is a 403) */
const freshSlug = (api: Client) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = randomSlug();
      if (!(yield* api.siteTaken(slug))) return slug;
    }
    return yield* fail("could not find a free slug, pass one with --slug");
  });

const upload = Command.make(
  "upload",
  {
    ...shared,
    source: Argument.Path("source", { mustExist: true }).pipe(
      Argument.withDescription("Directory (or a single .html / .md file) to publish"),
    ),
    slug: Flag.optional(Flag.String("slug").pipe(Flag.withAlias("s"))).pipe(
      Flag.withDescription("Site slug; a random three-word name when omitted"),
    ),
    private: Flag.Boolean("private").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Only signed-in, allow-listed users can view"),
    ),
    public: Flag.Boolean("public").pipe(
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
      const site = yield* api.putSite(slug, visibility);
      yield* Console.log(`→ ${site.visibility} site ${site.url} · ${files.length} file(s)`);

      yield* Effect.forEach(
        files,
        (file) =>
          Effect.gen(function* () {
            const uploaded = yield* api.putSiteFile(slug, file.relative, file.absolute, contentType(file.absolute));
            yield* Console.log(`  ↑ ${uploaded.path} (${formatBytes(uploaded.size)})`);
          }),
        { concurrency: TRANSFER_CONCURRENCY, discard: true },
      );

      const { removed } = yield* api.syncSite(
        slug,
        files.map((file) => file.relative),
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
    const sites = yield* api.listSites();
    if (sites.length === 0) return yield* Console.log("no sites yet");
    for (const site of sites) {
      yield* Console.log(`${site.visibility.padEnd(8)} ${formatUtc(site.updatedAt)}  ${site.url}`);
    }
  }),
).pipe(Command.withDescription("List your sites"));

const rm = Command.make(
  "rm",
  { ...shared, slug: Argument.String("slug").pipe(Argument.withDescription("Site to delete")) },
  (options) =>
    Effect.gen(function* () {
      const api = yield* client(options);
      yield* api.deleteSite(options.slug);
      yield* Console.log(`✔ deleted ${options.slug}`);
    }),
).pipe(Command.withDescription("Delete a site and all of its files"));

const whoami = Command.make("whoami", shared, (options) =>
  Effect.gen(function* () {
    const api = yield* client(options);
    const user = yield* api.me();
    yield* Console.log(`@${user.login} (${options.url})`);
  }),
).pipe(Command.withDescription("Show logged-in user and the tools API URL"));

const login = Command.make(
  "login",
  {
    ...shared,
    device: Flag.Boolean("device").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Show a code to approve in any browser instead of opening one here"),
    ),
  },
  (options) =>
    Effect.gen(function* () {
      const token = yield* oauthLogin(options.url, { device: options.device });
      yield* Console.log("Verifying the authenticated identity with the tools API…");
      const user = yield* makeClient(options.url, token).me();
      yield* Console.log(`✔ signed in as @${user.login}`);
    }),
).pipe(Command.withDescription("Sign the CLI in through auth.blankparticle.com"));

/** Pull a site's files (yours, or anyone's public one) into a folder, exactly as stored */
const siteDownload = Command.make(
  "download",
  {
    ...shared,
    slug: Argument.String("slug").pipe(Argument.withDescription("Site to download")),
    dest: Argument.optional(Argument.Path("dest")).pipe(
      Argument.withDescription("Folder to write into (default: ./<slug>)"),
    ),
  },
  (options) =>
    Effect.gen(function* () {
      const api = yield* client(options);
      const { files } = yield* api.getSite(options.slug);
      const dest = Option.getOrElse(options.dest, () => options.slug);
      yield* Effect.forEach(
        files,
        (file) =>
          Effect.gen(function* () {
            const bytes = yield* api.getSiteFile(options.slug, file.path);
            if (yield* writeInto(dest, file.path, bytes)) yield* Console.log(`↓ ${file.path}`);
          }),
        { concurrency: TRANSFER_CONCURRENCY, discard: true },
      );
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

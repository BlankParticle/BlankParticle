import { createHash } from "node:crypto";
import { homedir } from "node:os";

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { UserError } from "./runtime.ts";

export const Credentials = Schema.Struct({ idToken: Schema.String, expiresAt: Schema.Number });
export type Credentials = typeof Credentials.Type;
const oauthError = (message: string) => new UserError({ message });

const credentialsDirectory = (path: Path.Path) => {
  const config = process.env.XDG_CONFIG_HOME;
  return path.join(config && path.isAbsolute(config) ? config : path.join(homedir(), ".config"), "bp", "credentials");
};
const credentialsFilename = (baseUrl: string) => `${createHash("sha256").update(baseUrl).digest("hex")}.json`;

/** Private file storage shared by macOS and Linux, including headless sessions. */
export const loadCredentials = (baseUrl: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const raw = yield* fs
      .readFileString(path.join(credentialsDirectory(path), credentialsFilename(baseUrl)))
      .pipe(
        Effect.catch((error) =>
          error.reason._tag === "NotFound"
            ? Effect.succeed(null)
            : Effect.fail(
                oauthError("could not read OAuth credentials; check permissions on the bp credentials directory"),
              ),
        ),
      );
    if (raw === null) return null;
    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Credentials))(raw).pipe(
      Effect.mapError(() => oauthError("stored OAuth credentials are invalid; run `bp login` again")),
    );
  });

export const saveCredentials = (baseUrl: string, credentials: Credentials) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = credentialsDirectory(path);
    yield* fs.makeDirectory(directory, { recursive: true, mode: 0o700 });
    yield* fs.chmod(directory, 0o700);
    const temporary = yield* fs.makeTempDirectoryScoped({ directory, prefix: ".login-" });
    const file = path.join(temporary, "credentials.json");
    yield* fs.writeFileString(file, JSON.stringify(credentials), { mode: 0o600, flag: "wx" });
    yield* fs.rename(file, path.join(directory, credentialsFilename(baseUrl)));
  }).pipe(
    Effect.scoped,
    Effect.mapError(() =>
      oauthError("could not save OAuth credentials; check permissions on the bp credentials directory"),
    ),
  );

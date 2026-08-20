import { Resource } from "alchemy";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { Content } from "../content.ts";
import { capture, Command } from "./Command.ts";
import { ToolNotFoundError, VersionResolutionError } from "./Errors.ts";
import { ManagedPath } from "./ManagedPath.ts";
import type { FleetProviders, ProviderModule } from "./Providers.ts";

const Manifest = Schema.fromJsonString(
  Schema.Struct({
    platforms: Schema.Record(
      Schema.String,
      Schema.Struct({
        checksum: Schema.String,
      }),
    ),
  }),
);

const makeClaude = Effect.gen(function* () {
  const command = yield* Command;
  const current = Effect.gen(function* () {
    const located = yield* command.run(
      [
        "/bin/sh",
        "-c",
        'command -v claude || { test -x "$HOME/.local/bin/claude" && printf %s "$HOME/.local/bin/claude"; }',
      ],
      { allowFailure: true },
    );
    const bin = located.output.trim();
    if (located.exitCode !== 0 || !bin) return undefined;
    const version = (yield* capture([bin, "--version"])).output.trim().split(" ")[0];
    return version ? { bin, version } : undefined;
  });
  const latest = Effect.gen(function* () {
    const version = (yield* command.run([
      "/bin/sh",
      "-c",
      "if command -v curl >/dev/null; then curl -fsSL https://downloads.claude.ai/claude-code-releases/latest; else wget -qO- https://downloads.claude.ai/claude-code-releases/latest; fi",
    ])).output.trim();
    if (!/^\d+\.\d+\.\d+(?:-[^\s]+)?$/.test(version))
      return yield* Effect.fail(new VersionResolutionError({ tool: "claude", spec: "latest" }));
    return version;
  });
  const install = Effect.fn(function* (version: string) {
    const [system, machine] = yield* Effect.all([
      command.run(["uname", "-s"]).pipe(Effect.map(({ output }) => output.trim().toLowerCase())),
      command.run(["uname", "-m"]).pipe(Effect.map(({ output }) => output.trim().toLowerCase())),
    ]);
    const architecture =
      machine === "arm64" || machine === "aarch64"
        ? "arm64"
        : machine === "x86_64" || machine === "amd64"
          ? system === "darwin" &&
            (yield* command.run(["sysctl", "-n", "sysctl.proc_translated"], { allowFailure: true })).output.trim() ===
              "1"
            ? "arm64"
            : "x64"
          : undefined;
    if ((system !== "darwin" && system !== "linux") || !architecture)
      return yield* Effect.fail(
        new VersionResolutionError({ tool: "claude", spec: `${version} for ${system}-${machine}` }),
      );
    const musl =
      system === "linux" &&
      (yield* command.run(
        [
          "/bin/sh",
          "-c",
          "test -f /lib/libc.musl-x86_64.so.1 || test -f /lib/libc.musl-aarch64.so.1 || ldd /bin/ls 2>&1 | grep -q musl",
        ],
        { allowFailure: true },
      )).exitCode === 0;
    const platform = `${system}-${architecture}${musl ? "-musl" : ""}`;
    const base = `https://downloads.claude.ai/claude-code-releases/${version}`;
    const manifest = yield* Schema.decodeUnknownEffect(Manifest)(
      (yield* command.run([
        "/bin/sh",
        "-c",
        'if command -v curl >/dev/null; then curl -fsSL "$1"; else wget -qO- "$1"; fi',
        "fleet-claude-manifest",
        `${base}/manifest.json`,
      ])).output,
    );
    const checksum = manifest.platforms[platform]?.checksum;
    if (!checksum)
      return yield* Effect.fail(new VersionResolutionError({ tool: "claude", spec: `${version} for ${platform}` }));
    yield* command.run([
      "/bin/sh",
      "-c",
      `set -eu
version=$1
checksum=$2
url=$3
directory="$HOME/.local/share/claude/versions"
target="$directory/$version"
checksum_file() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null; then shasum -a 256 "$1" | cut -d ' ' -f 1
  else echo "sha256sum or shasum is required" >&2; return 1
  fi
}
mkdir -p "$directory" "$HOME/.local/bin"
if test ! -f "$target" || test "$(checksum_file "$target")" != "$checksum"; then
  temporary=$(mktemp -t fleet-claude.XXXXXX)
  trap 'rm -f "$temporary"' EXIT HUP INT TERM
  if command -v curl >/dev/null; then curl -fsSL -o "$temporary" "$url"
  else wget -qO "$temporary" "$url"
  fi
  test "$(checksum_file "$temporary")" = "$checksum"
  chmod 755 "$temporary"
  mv -f "$temporary" "$target"
  trap - EXIT HUP INT TERM
fi
chmod 755 "$target"
ln -sfn "$target" "$HOME/.local/bin/claude"`,
      "fleet-claude-install",
      version,
      checksum,
      `${base}/${platform}/claude`,
    ]);
  });
  return { current, latest, install };
});

type Claude = Effect.Success<typeof makeClaude>;
const Claude = Context.Service<Claude>("Fleet/Claude");
const ClaudeLayer = Layer.effect(Claude, makeClaude);

export type Toolchain = Resource<
  "Fleet.Claude.Toolchain",
  Record<never, never>,
  { bin: string; version: string },
  never,
  FleetProviders
>;
export const Toolchain = Resource<Toolchain>("Fleet.Claude.Toolchain");

export const ToolchainProvider = () =>
  Provider.succeed(
    Toolchain,
    Toolchain.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* () {
        const claude = yield* Claude;
        return (yield* claude.current)?.version === (yield* claude.latest)
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const claude = yield* Claude;
        const current = yield* claude.current;
        const version = yield* claude.latest;
        if (current?.version === version) return current;
        yield* claude.install(version);
        const installed = yield* claude.current;
        if (!installed)
          return yield* Effect.fail(new ToolNotFoundError({ tool: "claude", hint: "automatic installation failed" }));
        if (installed.version !== version)
          return yield* Effect.fail(new VersionResolutionError({ tool: "claude", spec: version }));
        return installed;
      }),
      delete: () => Effect.void,
      read: Effect.fn(function* () {
        return yield* (yield* Claude).current;
      }),
    }),
  );

interface PathAttributes {
  readonly path: string;
}

export type Instructions = Resource<"Fleet.Claude.Instructions", Content, PathAttributes, never, FleetProviders>;
export const Instructions = Resource<Instructions>("Fleet.Claude.Instructions");

export const InstructionsProvider = () =>
  Provider.succeed(
    Instructions,
    Instructions.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const managed = yield* ManagedPath;
        return (yield* managed.converged({ target: ".claude/CLAUDE.md", ...news }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        return yield* (yield* ManagedPath).write({ target: ".claude/CLAUDE.md", ...news });
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds) return undefined;
        const managed = yield* ManagedPath;
        const path = managed.resolve(".claude/CLAUDE.md");
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path };
        return (yield* managed.converged({ target: ".claude/CLAUDE.md", ...olds })) ? attributes : Unowned(attributes);
      }),
    }),
  );

export type Skill = Resource<
  "Fleet.Claude.Skill",
  Content & { readonly name: string },
  PathAttributes,
  never,
  FleetProviders
>;
export const Skill = Resource<Skill>("Fleet.Claude.Skill");

export const SkillProvider = () =>
  Provider.succeed(
    Skill,
    Skill.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const managed = yield* ManagedPath;
        return (yield* managed.converged({
          target: `.claude/skills/${news.name}/${news.source.filename ?? "SKILL.md"}`,
          ...news,
        }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        const managed = yield* ManagedPath;
        yield* managed.write({
          target: `.claude/skills/${news.name}/${news.source.filename ?? "SKILL.md"}`,
          ...news,
        });
        return { path: managed.resolve(`.claude/skills/${news.name}`) };
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.name) return undefined;
        const managed = yield* ManagedPath;
        const props = {
          target: `.claude/skills/${olds.name}/${olds.source.filename ?? "SKILL.md"}`,
          ...olds,
        };
        const path = managed.resolve(props.target);
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path: managed.resolve(`.claude/skills/${olds.name}`) };
        return (yield* managed.converged(props)) ? attributes : Unowned(attributes);
      }),
    }),
  );

export const ClaudeProviders: ProviderModule = {
  resources: [Toolchain, Instructions, Skill],
  layer: Layer.mergeAll(ToolchainProvider(), InstructionsProvider(), SkillProvider()).pipe(
    Layer.provideMerge(ClaudeLayer),
  ),
};

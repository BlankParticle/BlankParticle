// Homebrew on yoru: Fleet.Brew.Toolchain, Fleet.Brew.Tap,
// Fleet.Brew.Package (formulae), and Fleet.Brew.Cask.
// Plan-time state comes from one bulk snapshot per run; reconcile re-probes
// the single item live so it converges from any starting point. Third-party
// taps and tap-qualified casks get `brew trust`ed during reconcile (brew 6
// refuses untrusted tap loads). Packages installed manually but never
// declared are never touched.
import { Resource } from "alchemy";
import { isResolved } from "alchemy/Diff";
import * as Namespace from "alchemy/Namespace";
import * as Provider from "alchemy/Provider";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { capture, Command, sh } from "./Command.ts";
import { Elevation } from "./Elevation.ts";
import { ToolNotFoundError } from "./Errors.ts";
import { TargetPlatform } from "./Platform.ts";
import type { FleetProviders, ProviderModule } from "./Providers.ts";
import { Source as ZshSource } from "./Zsh.ts";

// installed lists print bare tokens, declared names may be tap-qualified
const token = (name: string) => name.split("/").at(-1)!;

const makeHomebrew = Effect.gen(function* () {
  const platform = yield* TargetPlatform;
  const command = yield* Command;
  const elevation = yield* Elevation;
  const locate = Effect.fn(function* () {
    const result = yield* command.run(
      [
        "/bin/sh",
        "-c",
        "command -v brew || { test -x /opt/homebrew/bin/brew && printf /opt/homebrew/bin/brew; } || { test -x /usr/local/bin/brew && printf /usr/local/bin/brew; }",
      ],
      { allowFailure: true },
    );
    return result.exitCode === 0 ? result.output.trim() || undefined : undefined;
  });

  const [info, invalidate] = yield* Effect.cachedInvalidateWithTTL(
    Effect.gen(function* () {
      yield* platform.require("Brew", { os: "darwin" });
      const bin = yield* locate();
      if (!bin)
        return {
          available: false as const,
          formulae: new Set<string>(),
          casks: new Set<string>(),
          taps: new Set<string>(),
          outdated: new Set<string>(),
          pinned: new Set<string>(),
        };
      const list = Effect.fn(function* (argv: readonly [string, ...string[]]) {
        return new Set((yield* command.run(argv)).output.split("\n").filter(Boolean).map(token));
      });
      return {
        available: true as const,
        bin,
        formulae: yield* list([bin, "list", "--formula", "-1"]),
        casks: yield* list([bin, "list", "--cask", "-1"]),
        taps: new Set((yield* command.run([bin, "tap"])).output.split("\n").filter(Boolean)),
        outdated: new Set([
          ...(yield* list([bin, "outdated", "--formula", "--quiet"])),
          ...(yield* list([bin, "outdated", "--cask", "--quiet"])),
        ]),
        // pinned packages are held at their version: never upgraded
        pinned: yield* list([bin, "list", "--pinned"]),
      };
    }),
    Duration.infinity,
  );

  const ensure = yield* Effect.cached(
    Effect.gen(function* () {
      const current = yield* info;
      if (current.available) return current.bin;
      const session = yield* elevation.setup;
      yield* session.runWithSudoAccess(
        [
          "/bin/bash",
          "-c",
          "curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | /bin/bash",
        ],
        { env: { NONINTERACTIVE: "1" } },
      );
      yield* invalidate;
      const installed = yield* info;
      if (!installed.available) {
        return yield* Effect.fail(new ToolNotFoundError({ tool: "brew", hint: "automatic installation failed" }));
      }
      return installed.bin;
    }),
  );
  const installPackage = Effect.fn(function* (name: string) {
    const current = yield* info;
    const packageToken = token(name);
    if (current.formulae.has(packageToken) && (!current.outdated.has(packageToken) || current.pinned.has(packageToken)))
      return;
    const bin = yield* ensure;
    yield* command.run([bin, current.formulae.has(packageToken) ? "upgrade" : "install", name]);
    yield* invalidate;
  });
  const removePackage = Effect.fn(function* (name: string) {
    const current = yield* info;
    if (!current.available) return;
    const installed = yield* command.run([current.bin, "list", "--formula", "--versions", token(name)], {
      allowFailure: true,
    });
    if (installed.exitCode !== 0) return;
    yield* command.run([current.bin, "uninstall", name]);
    yield* invalidate;
  });
  const removeCask = Effect.fn(function* (name: string) {
    const current = yield* info;
    if (!current.available) return;
    const installed = yield* command.run([current.bin, "list", "--cask", "--versions", token(name)], {
      allowFailure: true,
    });
    if (installed.exitCode !== 0) return;
    yield* command.run([current.bin, "uninstall", "--cask", name]);
    yield* invalidate;
  });
  const removeTap = Effect.fn(function* (name: string) {
    const current = yield* info;
    if (!current.available) return;
    const taps = (yield* command.run([current.bin, "tap"])).output.split("\n");
    if (!taps.includes(name)) return;
    yield* command.run([current.bin, "untap", name]);
    yield* invalidate;
  });
  return { info, ensure, installPackage, removePackage, removeCask, removeTap };
});

type Homebrew = Effect.Success<typeof makeHomebrew>;
const Homebrew = Context.Service<Homebrew>("Fleet/Homebrew");
const HomebrewLayer = Layer.effect(Homebrew, makeHomebrew);
const info = Effect.flatMap(Homebrew, ({ info }) => info);
const ensure = Effect.flatMap(Homebrew, ({ ensure }) => ensure);

export interface PkgProps {
  name: string;
}

export interface PkgAttributes {
  name: string;
}

// ---- Fleet.Brew.Toolchain ----

export type Toolchain = Resource<"Fleet.Brew.Toolchain", Record<never, never>, { bin: string }, never, FleetProviders>;
const ToolchainResource = Resource<Toolchain>("Fleet.Brew.Toolchain");

export const Toolchain = Effect.fn("Fleet.Brew.Toolchain")(
  function* (id: string, props: Record<never, never> = {}) {
    const toolchain = yield* ToolchainResource("toolchain", props);
    yield* ZshSource("homebrew", {
      evaluate: [toolchain.bin, "shellenv"],
      dependsOn: toolchain,
    });
    return toolchain;
  },
  (effect, id: string) => effect.pipe(Namespace.push(id)),
);

export const ToolchainProvider = () =>
  Provider.succeed(
    ToolchainResource,
    ToolchainResource.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* () {
        return (yield* info).available ? { action: "noop" as const } : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* () {
        return { bin: yield* ensure };
      }),
      // Removing this declaration only stops managing Homebrew. Uninstalling it
      // would also remove user-owned packages and is too destructive to infer.
      delete: () => Effect.void,
      read: Effect.fn(function* () {
        const current = yield* info;
        return current.available ? { bin: current.bin } : undefined;
      }),
    }),
  );

// ---- Fleet.Brew.Tap ----

export type Tap = Resource<"Fleet.Brew.Tap", PkgProps, PkgAttributes, never, FleetProviders>;
export const Tap = Resource<Tap>("Fleet.Brew.Tap");

export const TapProvider = () =>
  Provider.succeed(
    Tap,
    Tap.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        return (yield* info).taps.has(news.name) ? { action: "noop" as const } : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const bin = yield* ensure;
        if (!(yield* capture([bin, "tap"])).output.split("\n").includes(news.name)) yield* sh([bin, "tap", news.name]);
        yield* sh([bin, "trust", news.name]);
        return { name: news.name };
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* Effect.flatMap(Homebrew, ({ removeTap }) => removeTap(output.name));
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.name) return undefined;
        return (yield* info).taps.has(olds.name) ? { name: olds.name } : undefined;
      }),
    }),
  );

// ---- Fleet.Brew.Package ----

export type Package = Resource<"Fleet.Brew.Package", PkgProps, PkgAttributes, never, FleetProviders>;
export const Package = Resource<Package>("Fleet.Brew.Package");

export const PackageProvider = () =>
  Provider.succeed(
    Package,
    Package.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const { formulae, outdated, pinned } = yield* info;
        if (!formulae.has(token(news.name))) return { action: "update" as const };
        if (outdated.has(token(news.name)) && !pinned.has(token(news.name))) return { action: "update" as const };
        return { action: "noop" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        yield* Effect.flatMap(Homebrew, ({ installPackage }) => installPackage(news.name));
        return { name: news.name };
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* Effect.flatMap(Homebrew, ({ removePackage }) => removePackage(output.name));
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.name) return undefined;
        return (yield* info).formulae.has(token(olds.name)) ? { name: olds.name } : undefined;
      }),
    }),
  );

// ---- Fleet.Brew.Cask ----

export type Cask = Resource<"Fleet.Brew.Cask", PkgProps, PkgAttributes, never, FleetProviders>;
export const Cask = Resource<Cask>("Fleet.Brew.Cask");

export const CaskProvider = () =>
  Provider.succeed(
    Cask,
    Cask.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const { casks, outdated, pinned } = yield* info;
        if (!casks.has(token(news.name))) return { action: "update" as const };
        if (outdated.has(token(news.name)) && !pinned.has(token(news.name))) return { action: "update" as const };
        return { action: "noop" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const current = yield* info;
        const caskToken = token(news.name);
        if (current.casks.has(caskToken) && (!current.outdated.has(caskToken) || current.pinned.has(caskToken)))
          return { name: news.name };
        const bin = yield* ensure;
        if (news.name.includes("/")) yield* sh([bin, "trust", "--cask", news.name]);
        if (current.casks.has(caskToken)) yield* sh([bin, "upgrade", "--cask", news.name]);
        else yield* sh([bin, "install", "--cask", "--adopt", news.name]);
        return { name: news.name };
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* Effect.flatMap(Homebrew, ({ removeCask }) => removeCask(output.name));
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.name) return undefined;
        return (yield* info).casks.has(token(olds.name)) ? { name: olds.name } : undefined;
      }),
    }),
  );

export const HomebrewProviders: ProviderModule = {
  resources: [ToolchainResource, Tap, Package, Cask],
  layer: Layer.mergeAll(ToolchainProvider(), TapProvider(), PackageProvider(), CaskProvider()).pipe(
    Layer.provideMerge(HomebrewLayer),
  ),
};

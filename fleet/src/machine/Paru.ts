// Fleet.Paru.Package on orion — paru resolves repo and AUR packages alike, so one
// resource kind covers both. Manually installed packages are never touched:
// only resources tracked in state get deleted when dropped.
import { Resource } from "alchemy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Command } from "./Command.ts";
import { Elevation } from "./Elevation.ts";
import { ToolNotFoundError } from "./Errors.ts";
import type { PkgAttributes, PkgProps } from "./Homebrew.ts";
import { TargetPlatform } from "./Platform.ts";
import type { FleetProviders, ProviderModule } from "./Providers.ts";

const makeParu = Effect.gen(function* () {
  const platform = yield* TargetPlatform;
  const command = yield* Command;
  const elevation = yield* Elevation;
  const [installed, invalidateInstalled] = yield* Effect.cachedInvalidateWithTTL(
    Effect.gen(function* () {
      yield* platform.require("Paru", { os: "linux", distribution: "arch" });
      return new Set((yield* command.run(["pacman", "-Qq"])).output.split("\n").filter(Boolean));
    }),
    Duration.infinity,
  );

  const ensure = yield* Effect.cached(
    Effect.gen(function* () {
      yield* platform.require("Paru", { os: "linux", distribution: "arch" });
      const existing = yield* command.run(["/bin/sh", "-c", "command -v paru"], { allowFailure: true });
      if (existing.exitCode === 0 && existing.output.trim()) return existing.output.trim();

      const session = yield* elevation.setup;
      yield* session.run(["pacman", "-Syu", "--needed", "--noconfirm", "base-devel", "git"]);
      const temporary = (yield* command.run(["mktemp", "-d", "-t", "fleet-paru.XXXXXX"])).output.trim();
      const source = `${temporary}/paru-bin`;
      yield* Effect.gen(function* () {
        yield* command.run(["git", "clone", "--depth", "1", "https://aur.archlinux.org/paru-bin.git", source]);
        yield* command.run(["/bin/sh", "-c", 'cd "$1" && makepkg --force --noconfirm', "fleet", source]);
        const archive = (yield* command.run([
          "find",
          source,
          "-maxdepth",
          "1",
          "-type",
          "f",
          "-name",
          "*.pkg.tar.zst",
          "-print",
          "-quit",
        ])).output.trim();
        if (!archive)
          return yield* Effect.fail(
            new ToolNotFoundError({ tool: "paru", hint: "paru-bin did not produce a package" }),
          );
        yield* session.run(["pacman", "-U", "--needed", "--noconfirm", archive]);
      }).pipe(Effect.ensuring(command.run(["rm", "-rf", "--", temporary], { allowFailure: true }).pipe(Effect.ignore)));

      const installed = yield* command.run(["/bin/sh", "-c", "command -v paru"], { allowFailure: true });
      if (installed.exitCode !== 0 || !installed.output.trim())
        return yield* Effect.fail(new ToolNotFoundError({ tool: "paru", hint: "automatic installation failed" }));
      return installed.output.trim();
    }),
  );
  const installPackage = Effect.fn(function* (name: string) {
    if ((yield* installed).has(name)) return;
    const bin = yield* ensure;
    const session = yield* elevation.setup;
    yield* session.runWithSudoCommand((sudo) => [bin, "-S", "--needed", "--noconfirm", "--sudo", sudo, name]);
    yield* invalidateInstalled;
  });
  const removePackage = Effect.fn(function* (name: string) {
    if ((yield* command.run(["pacman", "-Qq", name], { allowFailure: true })).exitCode !== 0) return;
    const session = yield* elevation.setup;
    yield* session.run(["pacman", "-Rns", "--noconfirm", name]);
    yield* invalidateInstalled;
  });
  return { installed, installPackage, removePackage };
});

type Paru = Effect.Success<typeof makeParu>;
const Paru = Context.Service<Paru>("Fleet/Paru");
const ParuLayer = Layer.effect(Paru, makeParu);
const installed = Effect.flatMap(Paru, ({ installed }) => installed);

export type Package = Resource<"Fleet.Paru.Package", PkgProps, PkgAttributes, never, FleetProviders>;
export const Package = Resource<Package>("Fleet.Paru.Package");

export const PackageProvider = () =>
  Provider.succeed(
    Package,
    Package.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        return (yield* installed).has(news.name) ? { action: "noop" as const } : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        yield* Effect.flatMap(Paru, ({ installPackage }) => installPackage(news.name));
        return { name: news.name };
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* Effect.flatMap(Paru, ({ removePackage }) => removePackage(output.name));
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.name) return undefined;
        return (yield* installed).has(olds.name) ? { name: olds.name } : undefined;
      }),
    }),
  );

export const ParuProviders: ProviderModule = {
  resources: [Package],
  layer: PackageProvider().pipe(Layer.provideMerge(ParuLayer)),
};

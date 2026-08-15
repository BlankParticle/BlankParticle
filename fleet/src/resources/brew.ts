// Homebrew on yoru: taps, formulae, casks. One machine snapshot per run,
// shared by the three kinds. Third-party taps and tap-qualified casks get
// `brew trust`ed during their apply (brew 6 refuses untrusted tap loads).
import fs from "node:fs";

import { capture, fail, run } from "../exec.ts";
import { many, ResourceKind } from "../resource.ts";

const BREW = "/opt/homebrew/bin/brew";

// installed lists print bare tokens, declared names may be tap-qualified
const token = (name: string) => name.split("/").at(-1)!;

class Homebrew {
  private snapshot: { formulae: Set<string>; casks: Set<string>; taps: Set<string>; outdated: Set<string> } | null =
    null;

  info() {
    if (this.snapshot) return this.snapshot;
    if (!fs.existsSync(BREW)) fail("brew not found — install from https://brew.sh");
    const list = (argv: string[]) =>
      new Set((capture(argv).stdout ?? "").split("\n").filter(Boolean).map(token));
    this.snapshot = {
      formulae: list([BREW, "list", "--formula", "-1"]),
      casks: list([BREW, "list", "--cask", "-1"]),
      taps: new Set((capture([BREW, "tap"]).stdout ?? "").split("\n").filter(Boolean)),
      outdated: new Set([
        ...list([BREW, "outdated", "--formula", "--quiet"]),
        ...list([BREW, "outdated", "--cask", "--quiet"]),
      ]),
    };
    return this.snapshot;
  }
}

const machine = new Homebrew();

class TapKind extends ResourceKind<string> {
  private brew: Homebrew;

  constructor(brew: Homebrew) {
    super("tap", "darwin");
    this.brew = brew;
  }

  id = (name: string) => name;
  state = (name: string) => (this.brew.info().taps.has(name) ? ("ok" as const) : ("missing" as const));

  create(name: string) {
    run([BREW, "tap", name]);
    run([BREW, "trust", name]);
  }

  destroy = (name: string) => run([BREW, "untap", name], { allowFailure: true });
}

class FormulaKind extends ResourceKind<string> {
  private brew: Homebrew;

  constructor(brew: Homebrew) {
    super("brew", "darwin");
    this.brew = brew;
  }

  id = (name: string) => name;

  state(name: string) {
    if (!this.brew.info().formulae.has(token(name))) return "missing" as const;
    return this.brew.info().outdated.has(token(name)) ? ("differs" as const) : ("ok" as const);
  }

  create = (name: string) =>
    run([BREW, this.brew.info().formulae.has(token(name)) ? "upgrade" : "install", name]);

  destroy = (name: string) => run([BREW, "uninstall", name], { allowFailure: true });
}

class CaskKind extends ResourceKind<string> {
  private brew: Homebrew;

  constructor(brew: Homebrew) {
    super("cask", "darwin");
    this.brew = brew;
  }

  id = (name: string) => name;

  state(name: string) {
    if (!this.brew.info().casks.has(token(name))) return "missing" as const;
    return this.brew.info().outdated.has(token(name)) ? ("differs" as const) : ("ok" as const);
  }

  create(name: string) {
    if (name.includes("/")) run([BREW, "trust", "--cask", name]);
    if (this.brew.info().casks.has(token(name))) run([BREW, "upgrade", "--cask", name]);
    else run([BREW, "install", "--cask", "--adopt", name]);
  }

  destroy = (name: string) => run([BREW, "uninstall", "--cask", name], { allowFailure: true });
}

export const tap = many(new TapKind(machine));
export const brew = many(new FormulaKind(machine));
export const cask = many(new CaskKind(machine));

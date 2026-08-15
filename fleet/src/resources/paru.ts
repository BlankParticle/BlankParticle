// paru on orion; resolves repo and AUR packages alike, so one kind covers
// both. Manually installed packages are never touched — removals only come
// from tracked keys.
import { capture, run } from "../exec.ts";
import { many, ResourceKind } from "../resource.ts";

class ParuKind extends ResourceKind<string> {
  private snapshot: Set<string> | null = null;

  constructor() {
    super("paru", "linux");
  }

  private installed() {
    return (this.snapshot ??= new Set((capture(["pacman", "-Qq"]).stdout ?? "").split("\n").filter(Boolean)));
  }

  id = (name: string) => name;
  state = (name: string) => (this.installed().has(name) ? ("ok" as const) : ("missing" as const));
  create = (name: string) => run(["paru", "-S", "--needed", "--noconfirm", name]);

  destroy(name: string) {
    if (this.installed().has(name)) run(["paru", "-Rns", "--noconfirm", name], { allowFailure: true });
  }
}

export const paru = many(new ParuKind());

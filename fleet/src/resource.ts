// The resource lifecycle. Every kind of thing fleet manages subclasses
// ResourceKind: it names its kind, optionally pins an os, and implements
// id/state/create/destroy. Instances of a kind (built with .resource()) all
// share the kind object, so per-run machine snapshots live as private state
// on the subclass — no module-level globals.
import os from "node:os";
import path from "node:path";

export const repoRoot = path.resolve(import.meta.dirname, "..");
export const home = os.homedir();

export interface Resource {
  key: string;
  /** Resource only exists on this platform; the driver filters by host os. */
  os?: "darwin" | "linux";
  /** null = converged and tracked, nothing to do. */
  plan(tracked: ReadonlySet<string>): "+" | "~" | "=" | null;
  apply(): void;
}

export type Fragment = Resource | readonly Fragment[];

export interface HostConfig {
  os: "darwin" | "linux";
  items: readonly Fragment[];
}

const kinds = new Map<string, ResourceKind<never>>();

export abstract class ResourceKind<S> {
  readonly kind: string;
  readonly os?: "darwin" | "linux";

  constructor(kind: string, os?: "darwin" | "linux") {
    this.kind = kind;
    this.os = os;
    kinds.set(kind, this as ResourceKind<never>);
  }

  abstract id(spec: S): string;
  abstract state(spec: S): "missing" | "differs" | "ok";
  abstract create(spec: S): void;
  /** Remove a tracked item that left the manifest, by id. */
  abstract destroy(id: string): void;

  resource(spec: S): Resource {
    const key = `${this.kind}:${this.id(spec)}`;
    return {
      key,
      os: this.os,
      plan: (tracked) => {
        const state = this.state(spec);
        if (state === "missing") return "+";
        if (state === "differs") return "~";
        return tracked.has(key) ? null : "=";
      },
      apply: () => this.create(spec),
    };
  }
}

export const destroyerFor = (kind: string): ((id: string) => void) | undefined => {
  const found = kinds.get(kind);
  return found && ((id) => found.destroy(id));
};

/** Name-list DSL for package-like kinds: paru("git", "bat") etc. */
export const many =
  (kind: ResourceKind<string>) =>
  (...names: string[]): Resource[] =>
    names.map((name) => kind.resource(name));

export const host = (os: HostConfig["os"], ...items: Fragment[]): HostConfig => ({ os, items });

export const flatten = (fragments: readonly Fragment[]): Resource[] =>
  fragments.flatMap((fragment) => (Array.isArray(fragment) ? flatten(fragment) : [fragment as Resource]));

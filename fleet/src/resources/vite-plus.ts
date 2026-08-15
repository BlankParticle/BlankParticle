// The vite-plus toolchain: vp itself, node versions, the default version,
// and global packages. The VitePlus class encapsulates the vp paths and the
// per-run snapshots the kinds plan against.
import fs from "node:fs";
import path from "node:path";

import { capture, run } from "../exec.ts";
import { home, ResourceKind, type Resource } from "../resource.ts";

const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

// "t3@nightly" -> "t3", "@scope/name" -> itself
const globalName = (spec: string) => {
  const at = spec.lastIndexOf("@");
  return at > 0 ? spec.slice(0, at) : spec;
};

class VitePlus {
  readonly home = process.env.VP_HOME ?? path.join(home, ".vite-plus");
  readonly bin = path.join(this.home, "bin/vp");
  private nodeSnapshot: string[] | null = null; // ["v26.7.0", ...]
  private globalSnapshot: Set<string> | null = null;

  installed() {
    return fs.existsSync(this.bin);
  }

  nodes() {
    return (this.nodeSnapshot ??= (capture([this.bin, "env", "list"]).stdout ?? "")
      .split("\n")
      .map((line) => line.replace("*", "").trim())
      .filter(Boolean));
  }

  globals() {
    return (this.globalSnapshot ??= new Set(
      stripAnsi(capture([this.bin, "list", "--global"]).stdout ?? "")
        .split("\n")
        .slice(2) // table header
        .map((row) => globalName(row.trim().split(/\s+/)[0] ?? ""))
        .filter(Boolean),
    ));
  }

  setup() {
    run([this.bin, "env", "setup", "--refresh"]);
  }
}

class ToolchainKind extends ResourceKind<null> {
  private vp: VitePlus;

  constructor(vp: VitePlus) {
    super("vp");
    this.vp = vp;
  }

  id = () => "toolchain";

  state() {
    if (!this.vp.installed()) return "missing" as const;
    const check = capture([this.vp.bin, "upgrade", "--check"]).stdout ?? "";
    return check.includes("Already up to date") ? ("ok" as const) : ("differs" as const);
  }

  create() {
    if (!this.vp.installed())
      run(["/bin/bash", "-c", "curl -fsSL https://vite.plus | bash"], { env: { VP_HOME: this.vp.home } });
    else run([this.vp.bin, "upgrade"]);
    this.vp.setup();
  }

  // dropping the toolchain from the manifest just untracks it; removing it
  // for real is `vp implode`, too destructive to automate
  destroy() {}
}

class NodeKind extends ResourceKind<string> {
  private vp: VitePlus;

  constructor(vp: VitePlus) {
    super("vp-node");
    this.vp = vp;
  }

  id = (version: string) => version;
  state = (version: string) =>
    this.vp.nodes().some((v) => v.startsWith(`v${version}.`)) ? ("ok" as const) : ("missing" as const);
  create = (version: string) => run([this.vp.bin, "env", "install", version]);
  destroy = (version: string) => run([this.vp.bin, "env", "uninstall", version], { allowFailure: true });
}

class DefaultNodeKind extends ResourceKind<string> {
  private vp: VitePlus;

  constructor(vp: VitePlus) {
    super("vp-default");
    this.vp = vp;
  }

  id = (version: string) => version;

  state(version: string) {
    const current = /Default Node\.js version: (\S+)/.exec(capture([this.vp.bin, "env", "default"]).stdout ?? "");
    if (!current) return "missing" as const;
    return current[1].startsWith(`${version}.`) ? ("ok" as const) : ("differs" as const);
  }

  create = (version: string) => run([this.vp.bin, "env", "default", version]);
  destroy() {}
}

class GlobalKind extends ResourceKind<{ spec: string; node: string }> {
  private vp: VitePlus;

  constructor(vp: VitePlus) {
    super("vp-global");
    this.vp = vp;
  }

  id = (pkg: { spec: string }) => pkg.spec;

  state(pkg: { spec: string }) {
    if (!this.vp.globals().has(globalName(pkg.spec))) return "missing" as const;
    // a dist-tag spec (t3@nightly) means "latest under that tag" — the
    // installed build may lag, so refresh on every apply
    return globalName(pkg.spec) === pkg.spec ? ("ok" as const) : ("differs" as const);
  }

  create = (pkg: { spec: string; node: string }) =>
    run([this.vp.bin, "install", "--global", "--node", pkg.node, pkg.spec]);

  destroy = (spec: string) => run([this.vp.bin, "uninstall", "--global", globalName(spec)], { allowFailure: true });
}

const vp = new VitePlus();
const toolchain = new ToolchainKind(vp);
const node = new NodeKind(vp);
const defaultNode = new DefaultNodeKind(vp);
const global = new GlobalKind(vp);

/** The whole vite-plus toolchain as resources: vp itself (installed via
 * https://vite.plus, upgraded when `vp upgrade --check` says so), every node
 * version, the default version, and the global packages. */
export function vitePlus(config: {
  nodeVersions: string[];
  defaultNodeVersion: string;
  globalPackages: string[];
}): Resource[] {
  return [
    toolchain.resource(null),
    ...config.nodeVersions.map((version) => node.resource(version)),
    defaultNode.resource(config.defaultNodeVersion),
    ...config.globalPackages.map((spec) => global.resource({ spec, node: config.defaultNodeVersion })),
  ];
}

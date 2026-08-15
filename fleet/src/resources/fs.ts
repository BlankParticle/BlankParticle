// Files: repo paths, inline/template content, and skill directories, all
// landing as plain copies in $HOME. No symlinks — the target is always a
// real file tree.
import fs from "node:fs";
import path from "node:path";

import { fail } from "../exec.ts";
import { home, repoRoot, ResourceKind, type Resource } from "../resource.ts";

export interface Inline {
  kind: "inline";
  content: string;
}

interface FileSpec {
  source: string | Inline;
  target: string;
}

class FileKind extends ResourceKind<FileSpec> {
  constructor() {
    super("file");
  }

  id(spec: FileSpec) {
    return spec.target;
  }

  state(spec: FileSpec) {
    const target = path.join(home, spec.target);
    if (typeof spec.source === "string" && !fs.existsSync(path.join(repoRoot, spec.source)))
      fail(`manifest source missing: ${spec.source}`);
    const stat = fs.lstatSync(target, { throwIfNoEntry: false });
    if (!stat) return "missing" as const;
    if (typeof spec.source === "string")
      return this.contentEquals(path.join(repoRoot, spec.source), target) ? "ok" : "differs";
    return stat.isFile() && fs.readFileSync(target, "utf8") === spec.source.content ? "ok" : "differs";
  }

  // Overwrites whatever is in the way — everything declared lives in git,
  // and drift adoption (plan first, fold changes back) happens before apply.
  create(spec: FileSpec) {
    const target = path.join(home, spec.target);
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (typeof spec.source === "string") fs.cpSync(path.join(repoRoot, spec.source), target, { recursive: true });
    else fs.writeFileSync(target, spec.source.content);
  }

  destroy(target: string) {
    fs.rmSync(path.join(home, target), { recursive: true, force: true });
  }

  private contentEquals(source: string, target: string): boolean {
    const stat = fs.lstatSync(target, { throwIfNoEntry: false });
    if (!stat) return false;
    if (fs.statSync(source).isDirectory()) {
      if (!stat.isDirectory()) return false;
      const entries = fs.readdirSync(source).sort();
      if (entries.join("\n") !== fs.readdirSync(target).sort().join("\n")) return false;
      return entries.every((name) => this.contentEquals(path.join(source, name), path.join(target, name)));
    }
    if (!stat.isFile()) return false;
    return fs.readFileSync(source).equals(fs.readFileSync(target));
  }
}

const files = new FileKind();

/** Copy a repo path (relative to fleet/) into $HOME, or write inline/template
 * content there. Takes one (source, target) pair or a { source: target } map;
 * use the pair form when one source maps to several targets — map keys must
 * be unique. */
export function file(source: string | Inline, target: string): Resource;
export function file(map: Record<string, string>): Resource[];
export function file(sourceOrMap: string | Inline | Record<string, string>, target?: string): Resource | Resource[] {
  if (typeof sourceOrMap === "string" || sourceOrMap.kind === "inline")
    return files.resource({ source: sourceOrMap as string | Inline, target: target! });
  return Object.entries(sourceOrMap).map(([source, target]) => files.resource({ source, target }));
}

/** Same as file(); reads better when copying a directory. */
export const folder = file;

/** Inline file content for file() instead of a repo path. Dedents: drops the
 * first/last blank lines and strips the common indentation. */
export const source = (strings: TemplateStringsArray, ...values: unknown[]): Inline => {
  let text = strings[0];
  values.forEach((value, i) => (text += String(value) + strings[i + 1]));
  const lines = text.split("\n");
  if (lines[0]?.trim() === "") lines.shift();
  while (lines.length && lines.at(-1)!.trim() === "") lines.pop();
  const cut = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length));
  return { kind: "inline", content: lines.map((l) => l.slice(cut)).join("\n") + "\n" };
};

/** Read a repo file and fill {{key}} placeholders from vars. */
export const template = (source: string, vars: Record<string, string>): Inline => ({
  kind: "inline",
  content: fs
    .readFileSync(path.join(repoRoot, source), "utf8")
    .replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (!(key in vars)) throw new Error(`template ${source}: no value for ${match}`);
      return vars[key];
    }),
});

/** Copy every directory under sourceDir into each of the target directories
 * (e.g. one skill folder into every agent's discovery dir). */
export const skills = (sourceDir: string, targetDirs: string[]): Resource[] => {
  const abs = path.join(repoRoot, sourceDir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .flatMap((name) => targetDirs.map((dir) => file(`${sourceDir}/${name}`, `${dir}/${name}`)));
};

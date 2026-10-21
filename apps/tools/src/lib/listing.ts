import type { SharedFile } from "../api/spec.ts";
import { formatBytes, formatTimestamp } from "./format.ts";
import { escapeHtml, shell } from "./not-found.ts";

/** `files.<root>/<id>/`: the bundle's files as a folder, in the misprint design */
export function listingPage(options: { host: string; id: string; files: ReadonlyArray<SharedFile> }) {
  const total = options.files.reduce((sum, file) => sum + file.size, 0);
  const first = options.files[0];
  const expiry =
    first === undefined || first.expiresAt === null ? "never expires" : `expires ${formatTimestamp(first.expiresAt)}`;
  const rows = options.files
    .map(
      (file) =>
        `<tr><td><a href="${escapeHtml(file.url)}">${escapeHtml(file.name)}</a></td><td class="n">${escapeHtml(file.type.split(";")[0] ?? "")}</td><td class="n">${formatBytes(file.size)}</td></tr>`,
    )
    .join("\n");
  return shell({
    host: options.host,
    title: `${options.id} · ${options.host}`,
    status: 200,
    headerRight: `${options.files.length} file${options.files.length === 1 ? "" : "s"} · ${formatBytes(total)}`,
    stamp: `${first?.visibility === "private" ? "private · " : ""}${expiry}`,
    cacheControl: first?.visibility === "private" ? "private, no-store" : "public, max-age=60, must-revalidate",
    body: `<h1 class="folder reveal"><b>/</b>${escapeHtml(options.id)}<b>/</b></h1>
<table class="reveal d1">
<thead><tr><th>file</th><th class="n">type</th><th class="n">size</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`,
  });
}

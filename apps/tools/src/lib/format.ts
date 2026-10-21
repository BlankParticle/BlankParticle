/** Display formatting shared by the dashboard and the self-contained pages */

export function formatTimestamp(ts: number) {
  return `${new Date(ts).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

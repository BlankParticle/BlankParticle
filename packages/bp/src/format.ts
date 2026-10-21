/** How the CLI prints sizes and times. */

export const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

/** `2026-10-22 14:05`, in UTC */
export const formatUtc = (epochMillis: number) => new Date(epochMillis).toISOString().slice(0, 16).replace("T", " ");

export const ALL_IMAGES_IMPORT_MAP = Object.fromEntries(
  Object.entries(
    import.meta.glob("../content/blog/images/*", {
      query: "?url",
      eager: true,
      import: "default",
    }),
  ).map(([path, url]) => [path.replace("../content/blog/", "./"), url]),
) as Record<string, string>;

export const resolveImageUrl = (relativePath: string) => {
  const resolvedUrl = ALL_IMAGES_IMPORT_MAP[relativePath];
  if (!resolvedUrl) throw new Error(`Failed to resolve image URL for path: ${relativePath}`);
  return resolvedUrl;
};

export const blogImages = import.meta.glob("../content/blog/images/*", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Resolves a `./images/...` path from a blog post to its bundled asset URL. */
export function resolveBlogImage(path: string) {
  return blogImages[path.replace(/^\.\//, "../content/blog/")] ?? path;
}

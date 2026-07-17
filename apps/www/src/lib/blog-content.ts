import { allPosts } from "content-collections";

import { resolveImageUrl } from "./blog-images.ts";

// Posts are compiled at build time by content-collections; here we only swap
// the relative `./images/...` references for Vite's hashed asset URLs.
export const ALL_BLOG_POSTS = allPosts.map((post) => ({
  ...post,
  cover: post.cover?.startsWith("./images/") ? resolveImageUrl(post.cover) : post.cover,
  content: post.content.replace(/(src|href)="(\.\/images\/[^"]+)"/g, (_, attr, path) => {
    return `${attr}="${resolveImageUrl(path)}"`;
  }),
}));

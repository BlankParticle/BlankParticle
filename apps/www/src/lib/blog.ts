import { createServerFn } from "@tanstack/react-start";

export const fetchBlogPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { getPostList } = await import("./blog-content.ts");
  return getPostList();
});

export const fetchBlogPost = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }) => {
    const { getPost } = await import("./blog-content.ts");
    return getPost(data);
  });

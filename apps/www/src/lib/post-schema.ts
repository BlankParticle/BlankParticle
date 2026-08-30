import * as Schema from "effect/Schema";

/** Frontmatter of a blog post; shared by the fumadocs collection config and the frontmatter-only listing */
export const PostFrontmatter = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  tags: Schema.Array(Schema.String),
  cover: Schema.optional(Schema.String),
});

export type PostFrontmatter = Schema.Schema.Type<typeof PostFrontmatter>;

import { afterAll, describe, expect, it } from "vitest";

import { postsCollection } from "@/lib/db/mongo-collections";

import { createPost, deletePost, getPostForEdit, listPosts, updatePost } from "./mutations";
import { postInputSchema, type PostParsed } from "./validation";

/**
 * Integration against MongoDB: publish-date stamping, slug uniqueness and body
 * sanitisation are the parts a mock would get wrong. The shared Mongo client is
 * closed by test/setup.ts.
 */

const suffix = Date.now().toString(36);
const createdIds: string[] = [];

function input(over: Partial<Record<string, unknown>> = {}): PostParsed {
  return postInputSchema.parse({
    title: `Post ${suffix}`,
    slug: `post-${suffix}`,
    status: "draft",
    excerpt: "",
    body: "",
    coverImageAssetId: "",
    publishedAt: "",
    meta: { title: "", description: "", keywords: "" },
    ...over,
  });
}

async function create(over: Partial<Record<string, unknown>> = {}): Promise<string> {
  const result = await createPost(input(over), null);
  if (!result.ok) throw new Error(`create failed: ${JSON.stringify(result.errors)}`);
  createdIds.push(result.id);
  return result.id;
}

afterAll(async () => {
  if (createdIds.length) {
    await postsCollection().deleteMany({ _id: { $in: createdIds } });
  }
});

describe("blog mutations", () => {
  it("sanitises the body on write", async () => {
    const id = await create({
      slug: `post-${suffix}-a`,
      body: `<h2>Intro</h2><script>alert(1)</script><p onclick="x()">Hi</p>`,
    });
    const edit = await getPostForEdit(id);
    expect(edit?.body).toBe("<h2>Intro</h2><p>Hi</p>");
  });

  it("strips the literal \\n export artifact from the body", async () => {
    const bs = String.fromCharCode(92);
    const id = await create({ slug: `post-${suffix}-nl`, body: `<p>One.${bs}nTwo.</p>` });
    expect((await getPostForEdit(id))?.body).toBe("<p>One. Two.</p>");
  });

  it("does not stamp a publish date while a post is a draft", async () => {
    const id = await create({ slug: `post-${suffix}-draft` });
    expect((await getPostForEdit(id))?.publishedAt).toBe("");
  });

  it("stamps the publish date the first time a post is published", async () => {
    const id = await create({ slug: `post-${suffix}-pub`, status: "published" });
    const first = (await getPostForEdit(id))?.publishedAt;
    expect(first).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not move the publish date when a live post is re-saved", async () => {
    const id = await create({
      slug: `post-${suffix}-keep`,
      status: "published",
      publishedAt: "2020-01-02",
    });
    await updatePost(
      id,
      input({ slug: `post-${suffix}-keep`, status: "published", title: "Edited", publishedAt: "" }),
      null,
    );
    expect((await getPostForEdit(id))?.publishedAt).toBe("2020-01-02");
  });

  it("refuses a slug already in use", async () => {
    await create({ slug: `post-${suffix}-dup` });
    const result = await createPost(input({ slug: `post-${suffix}-dup` }), null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.slug).toBeTruthy();
  });

  it("lists posts and deletes one", async () => {
    const id = await create({ slug: `post-${suffix}-del` });
    expect((await listPosts()).some((p) => p.id === id)).toBe(true);

    await deletePost(id, null);
    const gone = await postsCollection().findOne({ _id: id });
    expect(gone).toBeNull();
  });
});

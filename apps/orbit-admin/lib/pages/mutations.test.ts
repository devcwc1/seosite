import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { pages } from "@/lib/db/schema";

import { createPage, deletePage, getPageForEdit, listPages, updatePage } from "./mutations";
import { pageInputSchema, type PageParsed } from "./validation";

/**
 * Integration against a real Postgres: slug uniqueness and content
 * sanitisation are the parts a mock would get wrong.
 */

const suffix = Date.now().toString(36);
const createdIds: string[] = [];

function input(over: Partial<Record<string, unknown>> = {}): PageParsed {
  return pageInputSchema.parse({
    title: `Page ${suffix}`,
    slug: `page-${suffix}`,
    status: "draft",
    content: "",
    meta: { title: "", description: "", keywords: "" },
    ...over,
  });
}

async function create(over: Partial<Record<string, unknown>> = {}): Promise<string> {
  const result = await createPage(input(over), null);
  if (!result.ok) throw new Error(`create failed: ${JSON.stringify(result.errors)}`);
  createdIds.push(result.id);
  return result.id;
}

afterAll(async () => {
  if (createdIds.length) await db.delete(pages).where(inArray(pages.id, createdIds));
  await pool.end();
});

describe("page mutations", () => {
  it("sanitises the content on write", async () => {
    const id = await create({
      slug: `page-${suffix}-a`,
      content: `<h2>Intro</h2><script>alert(1)</script><p onclick="x()">Hi</p>`,
    });
    const edit = await getPageForEdit(id);
    expect(edit?.content).toBe("<h2>Intro</h2><p>Hi</p>");
  });

  it("strips the literal \\n export artifact from the content", async () => {
    const bs = String.fromCharCode(92);
    const id = await create({ slug: `page-${suffix}-nl`, content: `<p>One.${bs}nTwo.</p>` });
    expect((await getPageForEdit(id))?.content).toBe("<p>One. Two.</p>");
  });

  it("stores the status and slug", async () => {
    const id = await create({ slug: `page-${suffix}-pub`, status: "published" });
    const edit = await getPageForEdit(id);
    expect(edit?.status).toBe("published");
    expect(edit?.slug).toBe(`page-${suffix}-pub`);
  });

  it("refuses a slug already in use", async () => {
    await create({ slug: `page-${suffix}-dup` });
    const result = await createPage(input({ slug: `page-${suffix}-dup` }), null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.slug).toBeTruthy();
  });

  it("refuses a slug taken by another page on update", async () => {
    const keepId = await create({ slug: `page-${suffix}-keep` });
    await create({ slug: `page-${suffix}-other` });
    const result = await updatePage(
      keepId,
      input({ slug: `page-${suffix}-other` }),
      null,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.slug).toBeTruthy();
  });

  it("lists pages and deletes one", async () => {
    const id = await create({ slug: `page-${suffix}-del` });
    expect((await listPages()).some((p) => p.id === id)).toBe(true);

    await deletePage(id, null);
    const [gone] = await db.select().from(pages).where(eq(pages.id, id));
    expect(gone).toBeUndefined();
  });
});

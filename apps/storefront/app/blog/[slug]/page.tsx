import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { StorefrontPost } from "@orbit/next";
import { articleJsonLd, breadcrumbJsonLd } from "@orbit/next/seo";

import { JsonLd } from "@/components/json-ld";
import { orbit } from "@/lib/orbit";
import { absoluteUrl, getSite, pageMetadata } from "@/lib/seo";

type PostPageProps = { params: Promise<{ slug: string }> };

async function loadPost(slug: string): Promise<StorefrontPost | null> {
  try {
    return await orbit.getPost(slug);
  } catch {
    return null;
  }
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    return (await orbit.listPosts()).map((post) => ({ slug: post.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "Post not found" };

  const site = await getSite();
  return pageMetadata(site, {
    path: `/blog/${post.slug}`,
    title: post.title,
    seo: post.seo,
    description: post.excerpt ?? post.body,
    images: post.coverImageUrl ? [post.coverImageUrl] : [],
  });
}

function formatDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const site = await getSite();
  const url = absoluteUrl(site, `/blog/${post.slug}`);

  return (
    <main className="shell py-section-gap">
      <JsonLd
        data={[
          articleJsonLd(post, { url, siteName: site.siteName, logoUrl: site.logoUrl }),
          breadcrumbJsonLd([
            { name: "Home", url: absoluteUrl(site, "/") },
            { name: "Blog", url: absoluteUrl(site, "/blog") },
            { name: post.title, url },
          ]),
        ]}
      />

      <nav aria-label="Breadcrumb" className="mb-lg">
        <ol className="flex flex-wrap items-center gap-xs text-body-sm text-on-surface-variant">
          <li>
            <Link href="/" className="transition-colors hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/blog" className="transition-colors hover:text-primary">
              Blog
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" className="font-medium text-on-surface">
            {post.title}
          </li>
        </ol>
      </nav>

      <article className="mx-auto max-w-3xl">
        <header className="mb-lg">
          {post.publishedAt ? (
            <p className="mb-sm text-label-md text-on-surface-variant uppercase">
              {formatDate(post.publishedAt)}
            </p>
          ) : null}
          <h1 className="text-headline-lg text-balance text-on-surface sm:text-display-lg">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-md text-body-lg text-on-surface-variant">{post.excerpt}</p>
          ) : null}
        </header>

        {post.coverImageUrl ? (
          <div className="mb-lg overflow-hidden rounded-lg border border-border-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="w-full object-cover"
            />
          </div>
        ) : null}

        {post.body ? (
          /* Sanitised on write against the same allowlist as product copy. */
          <div
            className="rich-text text-body-lg text-on-surface-variant"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        ) : null}
      </article>
    </main>
  );
}

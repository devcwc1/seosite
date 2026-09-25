import type { Metadata } from "next";
import Link from "next/link";
import type { StorefrontPost } from "@orbit/next";

import { ArrowRightIcon, ImagePlaceholderIcon } from "@/components/icons";
import { orbit } from "@/lib/orbit";
import { getSite, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return pageMetadata(site, {
    path: "/blog",
    title: "Blog",
    description: `Articles and updates from ${site.siteName}.`,
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

export default async function BlogIndexPage() {
  let posts: StorefrontPost[] = [];
  let reachable = true;
  try {
    posts = await orbit.listPosts();
  } catch {
    reachable = false;
  }

  return (
    <main className="shell py-section-gap">
      <header className="mb-lg max-w-3xl">
        <h1 className="mb-sm text-headline-lg text-balance text-on-surface sm:text-display-lg">
          Blog
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Articles, guides and updates.
        </p>
      </header>

      {!reachable ? (
        <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
          The blog is temporarily unreachable. It comes back on its own — please
          try again in a moment.
        </p>
      ) : posts.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No articles have been published yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest transition-shadow duration-300 hover:shadow-lift"
              >
                <div className="flex aspect-[1.6] items-center justify-center bg-surface-container">
                  {post.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.coverImageUrl}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <ImagePlaceholderIcon className="size-8 text-outline" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-md">
                  {post.publishedAt ? (
                    <p className="mb-xs text-label-md text-on-surface-variant uppercase">
                      {formatDate(post.publishedAt)}
                    </p>
                  ) : null}
                  <h2 className="mb-xs text-headline-sm text-on-surface">{post.title}</h2>
                  {post.excerpt ? (
                    <p className="mb-md line-clamp-3 text-body-sm text-on-surface-variant">
                      {post.excerpt}
                    </p>
                  ) : null}
                  <span className="mt-auto inline-flex items-center gap-xs text-label-md text-primary">
                    Read more
                    <ArrowRightIcon className="size-4" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

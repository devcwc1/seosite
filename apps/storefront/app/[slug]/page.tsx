import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { StorefrontPage } from "@orbit/next";
import { breadcrumbJsonLd } from "@orbit/next/seo";

import { JsonLd } from "@/components/json-ld";
import { orbit } from "@/lib/orbit";
import { absoluteUrl, getSite, pageMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ slug: string }> };

async function loadPage(slug: string): Promise<StorefrontPage | null> {
  try {
    return await orbit.getPage(slug);
  } catch {
    return null;
  }
}

/** Pre-render every published page; unknown slugs fall through to notFound. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    return (await orbit.listPages()).map((page) => ({ slug: page.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: "Page not found" };

  const site = await getSite();
  return pageMetadata(site, {
    path: `/${page.slug}`,
    title: page.title,
    seo: page.seo,
    description: page.content,
  });
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  const site = await getSite();
  const url = absoluteUrl(site, `/${page.slug}`);

  return (
    <main className="shell py-section-gap">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: absoluteUrl(site, "/") },
          { name: page.title, url },
        ])}
      />

      <nav aria-label="Breadcrumb" className="mb-lg">
        <ol className="flex flex-wrap items-center gap-xs text-body-sm text-on-surface-variant">
          <li>
            <Link href="/" className="transition-colors hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" className="font-medium text-on-surface">
            {page.title}
          </li>
        </ol>
      </nav>

      <article className="mx-auto max-w-3xl">
        <header className="mb-lg">
          <h1 className="text-headline-lg text-balance text-on-surface sm:text-display-lg">
            {page.title}
          </h1>
        </header>

        {page.content ? (
          /* Sanitised on write against the same allowlist as product copy. */
          <div
            className="rich-text text-body-lg text-on-surface-variant"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        ) : null}
      </article>
    </main>
  );
}

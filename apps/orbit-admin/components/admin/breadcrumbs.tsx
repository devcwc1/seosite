"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Segments that are route plumbing rather than something a reader navigated to. */
const HIDDEN = new Set(["(protected)"]);

/** Known segments whose title case is not just a capitalised slug. */
const LABELS: Record<string, string> = {
  new: "New",
  edit: "Edit",
  mfa: "Two-factor",
};

/** A UUID or other opaque id — shown as a short reference, not read aloud. */
function isOpaqueId(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) || /^\d+$/.test(segment);
}

function labelFor(segment: string): string {
  if (LABELS[segment]) return LABELS[segment];
  if (isOpaqueId(segment)) return `#${segment.slice(0, 8)}`;
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Breadcrumbs derived from the URL. The trail is never a link to itself:
 * the last crumb renders as `BreadcrumbPage` with aria-current, per the
 * WAI-ARIA breadcrumb pattern.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter((s) => s && !HIDDEN.has(s));

  // A single segment is the section itself; a trail of one tells nobody
  // anything, so the top bar stays quiet on landing pages.
  if (segments.length < 2) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const last = index === segments.length - 1;

          return (
            // The separator renders its own <li>, so it is a sibling of the
            // item, never a child. Nested inside one it is invalid HTML and
            // React fails hydration on every page that shows a trail.
            <Fragment key={href}>
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage>{labelFor(segment)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>
                    {labelFor(segment)}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {last ? null : <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

import Link from "next/link";

// Next renders this in its own bare document (`<html id="__next_error__">`)
// rather than inside the root layout, so the stylesheet has to come with it
// or the page arrives as unstyled serif text.
import "./globals.css";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Rendered with HTTP 403 whenever a route calls `forbidden()`.
 *
 * The distinction from 404 is deliberate: the reader is signed in and the
 * page exists, they simply hold the wrong role. Telling them so is what
 * makes "ask an admin" an obvious next step instead of a dead end.
 */
export default function Forbidden() {
  return (
    <div className="bg-background text-foreground mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center font-sans">
      <p className="text-muted-foreground text-caption font-medium tracking-widest uppercase">
        403
      </p>
      <h1 className="text-page-title">You do not have access to this page</h1>
      <p className="text-muted-foreground text-body">
        This area is limited to administrators. If you need it, ask an
        administrator to change your role.
      </p>
      {/* A link, not a button: it navigates, so it must behave like a link
          for keyboard and screen-reader users. Only the styling is borrowed. */}
      {/* cn() is not decoration here: buttonVariants alone leaves two
          conflicting border-colour utilities on the element and the wrong one
          wins. tailwind-merge resolves them. */}
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Back to dashboard
      </Link>
    </div>
  );
}

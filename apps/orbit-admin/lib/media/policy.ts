import { isAdmin, isWriter } from "@/lib/auth/session";
import type { User } from "@/lib/db/model-types";

/**
 * Who may do what to the media library — ORB-505, enforced per ORB-506/207.
 *
 * One module so the server guard and the control that renders it cannot
 * disagree. When they live apart, the UI is what people read as the rule, and
 * the server is what actually decides; a drift between them is either a
 * button that always errors or, worse, an action nobody meant to allow.
 */

/** Add new assets. Editors curate the library, so they upload. */
export function canUploadMedia(user: Pick<User, "role">): boolean {
  return isWriter(user);
}

/** Change an asset's title or alt text. Same reasoning as upload. */
export function canEditMedia(user: Pick<User, "role">): boolean {
  return isWriter(user);
}

/**
 * Remove an asset. Admin only, and deliberately narrower than editing:
 * deletion is the one media action that destroys work an editor cannot get
 * back, and assets are shared across products, so the cost of a mistake is
 * not confined to the person who makes it.
 */
export function canDeleteMedia(user: Pick<User, "role">): boolean {
  return isAdmin(user);
}

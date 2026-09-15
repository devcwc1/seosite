/**
 * The canonical status vocabulary — doc 15 §25.3.4.
 *
 * Every chip in the admin resolves its colour through this table. Screens
 * pass a domain and a value; they never choose a tone, and they never pass a
 * className. That is the whole point: a status looked identical on two
 * screens only by coincidence before, and coincidence does not survive a
 * fourth screen.
 *
 * Adding a status means adding a row here. If you find yourself wanting a
 * sixth tone, the design system has a decision to make first.
 */

/** The only five tones. Each maps to one token pair in globals.css. */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type StatusEntry = {
  tone: StatusTone;
  /** Shown to the reader. Sentence case — these sit inside prose. */
  label: string;
  /**
   * Read by assistive tech when the colour alone would carry meaning.
   * Omitted when the label already says everything.
   */
  description?: string;
};

/**
 * Domains backed by a column in the database today. These are exhaustive:
 * the keys match the pgEnum values exactly, and lib/status/registry.test.ts
 * fails if the two drift apart.
 */
const LIVE = {
  product: {
    draft: { tone: "neutral", label: "Draft" },
    published: { tone: "success", label: "Published" },
    archived: { tone: "neutral", label: "Archived" },
  },
  order: {
    pending: { tone: "warning", label: "Pending" },
    paid: { tone: "success", label: "Paid" },
    shipped: { tone: "info", label: "Shipped" },
    cancelled: { tone: "danger", label: "Cancelled" },
  },
  role: {
    admin: { tone: "info", label: "Admin" },
    editor: { tone: "neutral", label: "Editor" },
    viewer: { tone: "neutral", label: "Viewer" },
  },
} as const;

/**
 * Domains whose feature has not been built yet — there is no column behind
 * any of these. They are declared now so the first screen to need one
 * inherits the mapping instead of inventing a colour, which is the failure
 * mode this registry exists to prevent.
 *
 * The vocabularies below are a best reading of doc 15 §25.3.4 and the FR
 * references in ORB-106. Reconcile them against the spec before the owning
 * feature ships; `connect` in particular is a placeholder shape.
 */
const FORWARD = {
  /** Robots directives on a product or category page. */
  indexing: {
    indexed: { tone: "success", label: "Indexed" },
    noindex: {
      tone: "warning",
      label: "No-index",
      description: "Excluded from search engines",
    },
    blocked: {
      tone: "danger",
      label: "Blocked",
      description: "Disallowed by robots.txt",
    },
  },
  /** FR-API-003 — the sync chip that lives in the top bar. */
  sync: {
    synced: { tone: "success", label: "Synced" },
    syncing: { tone: "info", label: "Syncing" },
    stale: { tone: "warning", label: "Stale" },
    failed: { tone: "danger", label: "Sync failed" },
    disconnected: { tone: "neutral", label: "Disconnected" },
  },
  /** Deployment state of a published storefront build. */
  deployment: {
    queued: { tone: "neutral", label: "Queued" },
    building: { tone: "info", label: "Building" },
    live: { tone: "success", label: "Live" },
    failed: { tone: "danger", label: "Failed" },
    rolledBack: { tone: "warning", label: "Rolled back" },
  },
  /** Connect classification. Placeholder vocabulary — see the note above. */
  connect: {
    verified: { tone: "success", label: "Verified" },
    pending: { tone: "warning", label: "Pending review" },
    unverified: { tone: "neutral", label: "Unverified" },
    rejected: { tone: "danger", label: "Rejected" },
  },
} as const;

export const STATUS_REGISTRY = { ...LIVE, ...FORWARD } as const satisfies Record<
  string,
  Record<string, StatusEntry>
>;

export type StatusDomain = keyof typeof STATUS_REGISTRY;
export type StatusValue<D extends StatusDomain> = keyof (typeof STATUS_REGISTRY)[D];

/** Domains with a database column behind them, for the drift test. */
export const LIVE_DOMAINS = Object.keys(LIVE) as (keyof typeof LIVE)[];

export function statusEntry<D extends StatusDomain>(
  domain: D,
  value: StatusValue<D>,
): StatusEntry {
  return STATUS_REGISTRY[domain][value] as StatusEntry;
}

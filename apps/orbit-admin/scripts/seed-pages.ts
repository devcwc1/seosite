import "dotenv/config";

import { db, pool } from "../lib/db";
import { pages, type ProductMeta } from "../lib/db/schema";
import { logger } from "../lib/logger";

const log = logger.child({ script: "seed-pages" });

/**
 * Placeholder content pages for the Orbit reference storefront.
 *
 * The copy here is generic demo filler for the Orbit brand — swap it for real
 * content in the admin (Pages). Every page is published so it renders on the
 * storefront at /<slug>, inside the existing header and footer.
 */
type SeedPage = {
  slug: string;
  title: string;
  content: string;
  meta: ProductMeta;
};

const PAGES: SeedPage[] = [
  {
    slug: "about",
    title: "About Us",
    meta: {
      title: "About Orbit",
      description:
        "Orbit is a reference storefront built on the Orbit commerce platform.",
    },
    content: [
      "<p>Orbit is a reference storefront built to show what the Orbit commerce platform can do. Everything you see here — products, prices, images, and the words on this page — is published from the Orbit admin and read through the <strong>@orbit/next</strong> SDK.</p>",
      "<h2>Who we are</h2>",
      "<p>This is placeholder copy for the demo brand. Replace it with your own story: when you started, what you sell, and why customers choose you. Keep it short and specific — a couple of honest paragraphs beat a page of filler.</p>",
      "<h2>What we value</h2>",
      "<ul><li><strong>Clarity</strong> — honest descriptions and no surprises at checkout.</li><li><strong>Speed</strong> — orders packed and shipped quickly.</li><li><strong>Support</strong> — real help when you need it.</li></ul>",
      "<p>Edit this page in the admin under <strong>Pages → About Us</strong>.</p>",
    ].join(""),
  },
  {
    slug: "payments",
    title: "Payments",
    meta: {
      title: "Payments",
      description: "The payment methods accepted at the Orbit demo storefront.",
    },
    content: [
      "<h2>How you can pay</h2>",
      "<p>This is placeholder copy — list the payment methods you actually accept. For example:</p>",
      "<ul><li>Major debit and credit cards</li><li>iDEAL and other local bank transfers</li><li>Digital wallets such as Apple Pay and Google Pay</li></ul>",
      "<h2>Is it secure?</h2>",
      "<p>Describe how payments are handled and secured. Payments are processed by your payment provider over an encrypted connection; card details are never stored on our servers.</p>",
      "<h2>When are you charged?</h2>",
      "<p>Explain your billing timing — for most stores the full amount is taken when the order is placed. Edit this page under <strong>Pages → Payments</strong>.</p>",
    ].join(""),
  },
  {
    slug: "shipping",
    title: "Delivery & Shipping",
    meta: {
      title: "Delivery & Shipping",
      description: "Delivery options, timeframes and costs for the Orbit demo store.",
    },
    content: [
      "<h2>Delivery options</h2>",
      "<p>Placeholder copy — set out the carriers, regions, timeframes and costs you really offer. For example:</p>",
      "<ul><li><strong>Standard</strong> — 2–4 business days.</li><li><strong>Express</strong> — next business day on orders placed before the daily cut-off.</li><li><strong>Pick-up point</strong> — delivery to a nearby collection point.</li></ul>",
      "<h2>Shipping costs</h2>",
      "<p>State your rates and any free-shipping threshold. Shipping is calculated at checkout based on destination and the option you choose.</p>",
      "<h2>Where we ship</h2>",
      "<p>List the countries or regions you ship to. Edit this page under <strong>Pages → Delivery &amp; Shipping</strong>.</p>",
    ].join(""),
  },
  {
    slug: "track-order",
    title: "Track Your Order",
    meta: {
      title: "Track Your Order",
      description: "How to follow an order from confirmation to delivery.",
    },
    content: [
      "<h2>Following your order</h2>",
      "<p>Placeholder copy — explain how customers track an order. A typical flow:</p>",
      "<ul><li>You receive an order confirmation by email as soon as you check out.</li><li>When your order ships, we send a second email with a tracking link.</li><li>Use that link to follow the parcel to your door.</li></ul>",
      "<h2>Haven't had an update?</h2>",
      "<p>Tell customers what to do if tracking seems stuck — check spam, allow a day for the carrier to scan the parcel, then get in touch. See the <a href=\"/helpdesk\">Helpdesk</a> to reach us.</p>",
      "<p>Edit this page under <strong>Pages → Track Your Order</strong>.</p>",
    ].join(""),
  },
  {
    slug: "helpdesk",
    title: "Helpdesk",
    meta: {
      title: "Helpdesk",
      description: "How to reach the Orbit demo store for help with an order.",
    },
    content: [
      "<h2>How can we help?</h2>",
      "<p>Placeholder copy — put your real support channels and hours here. For example:</p>",
      "<ul><li><strong>Email</strong> — support@example.com, answered within one business day.</li><li><strong>Phone</strong> — +00 000 000 000, weekdays 9:00–17:00.</li><li><strong>Live chat</strong> — during business hours from any page.</li></ul>",
      "<h2>Common questions</h2>",
      "<p>Link out to the pages that answer the questions you get most: <a href=\"/shipping\">Delivery &amp; Shipping</a>, <a href=\"/payments\">Payments</a>, and <a href=\"/track-order\">Track Your Order</a>.</p>",
      "<p>Edit this page under <strong>Pages → Helpdesk</strong>.</p>",
    ].join(""),
  },
];

async function seedPages(): Promise<void> {
  for (const page of PAGES) {
    const [row] = await db
      .insert(pages)
      .values({
        slug: page.slug,
        title: page.title,
        content: page.content,
        status: "published",
        meta: page.meta,
      })
      .onConflictDoNothing({ target: pages.slug })
      .returning({ id: pages.id });

    if (row) {
      log.info({ slug: page.slug }, "Page seeded");
    } else {
      log.info({ slug: page.slug }, "Page already exists — left untouched");
    }
  }
}

seedPages()
  .then(() => log.info("Pages seed complete"))
  .catch((error) => {
    log.error({ err: error }, "Pages seed failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());

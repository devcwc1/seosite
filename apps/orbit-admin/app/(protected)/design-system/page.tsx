import type { Metadata } from "next";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_REGISTRY, type StatusDomain } from "@/lib/status/registry";

import { InteractiveCatalog } from "./interactive-catalog";

export const metadata: Metadata = { title: "Design system" };

/**
 * The component catalog — ORB-106's "catalog for component review".
 *
 * It lives inside the app rather than in Storybook on purpose: rendered here
 * it goes through the real token pipeline, the real Tailwind build and the
 * real theme, so what a reviewer signs off is what ships. A separate harness
 * can drift from the app it documents, and a catalog that drifts is worse
 * than none.
 *
 * It sits behind the auth wall like every other protected route.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-section-title">{title}</h2>
        <p className="text-muted-foreground text-body">{description}</p>
      </div>
      <div className="bg-background rounded-lg border p-4">{children}</div>
    </section>
  );
}

const DOMAIN_NOTES: Record<StatusDomain, string> = {
  product: "products.status",
  post: "posts.status",
  order: "orders.status",
  role: "users.role",
  mediaUsage: "computed from product_media + OG references",
  indexing: "no column yet — declared ahead of the SEO feature",
  sync: "no column yet — FR-API-003",
  deployment: "no column yet — declared ahead of deployments",
  connect: "no column yet — placeholder vocabulary, reconcile with doc 15",
};

export default function DesignSystemPage() {
  const domains = Object.keys(STATUS_REGISTRY) as StatusDomain[];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-page-title">Design system</h1>
        <p className="text-muted-foreground text-body">
          Every part below is the one the app uses. Nothing here is a copy.
        </p>
      </header>

      <Section
        title="Status chips"
        description="One mapping, used everywhere. Screens choose a domain and a value; they never choose a colour."
      >
        <div className="flex flex-col gap-5">
          {domains.map((domain) => (
            <div key={domain} className="flex flex-col gap-2">
              <p className="text-caption text-muted-foreground">
                <code className="font-medium">{domain}</code> — {DOMAIN_NOTES[domain]}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {Object.keys(STATUS_REGISTRY[domain]).map((value) => (
                  <StatusChip
                    key={value}
                    domain={domain}
                    // Values are read back off the registry, so the catalog
                    // cannot show a status the registry does not define.
                    value={value as never}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Banners"
        description="Page-level messages. Danger interrupts a screen reader; the rest wait their turn."
      >
        <div className="flex flex-col gap-3">
          <Banner tone="info" title="Scheduled maintenance on Sunday" />
          <Banner tone="success" title="All 4 products synced" />
          <Banner tone="warning" title="2 products have no meta description" />
          <Banner tone="danger" title="Sync failed">
            The content API refused the last three requests.
          </Banner>
        </div>
      </Section>

      <Section
        title="Type scale"
        description="Named steps, so screens stop hand-rolling size and weight pairings."
      >
        <div className="flex flex-col gap-2">
          <p className="text-page-title">Page title — text-page-title</p>
          <p className="text-section-title">Section title — text-section-title</p>
          <p className="text-body">Body — text-body</p>
          <p className="text-caption text-muted-foreground">
            Caption — text-caption
          </p>
        </div>
      </Section>

      <Section
        title="Buttons"
        description="Every variant, including the focus ring a keyboard user relies on."
      >
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section
        title="Tabs"
        description="Arrow keys move between tabs; the panel is reachable with one more Tab."
      >
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-body pt-3">
            Overview panel.
          </TabsContent>
          <TabsContent value="content" className="text-body pt-3">
            Content panel.
          </TabsContent>
          <TabsContent value="seo" className="text-body pt-3">
            SEO panel.
          </TabsContent>
        </Tabs>
      </Section>

      <InteractiveCatalog />
    </div>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrderSettingsForm } from "@/components/settings/order-settings-form";
import { SeoSettingsForm } from "@/components/settings/seo-settings-form";
import { getCurrentSession, isAdmin } from "@/lib/auth/session";
import {
  getConfiguredKeys,
  getOrderMoneySettings,
  SETTING_KEYS,
} from "@/lib/settings/store";
import { getSiteSeoSettings } from "@/lib/seo/site-settings-store";
import { assetUrlsById } from "@/lib/storefront/assets";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  const canEdit = !!session && isAdmin(session.user);

  const [money, configuredKeys, seo] = await Promise.all([
    getOrderMoneySettings(),
    getConfiguredKeys(),
    getSiteSeoSettings(),
  ]);

  const seoImages = await assetUrlsById([seo.defaultOgImageAssetId, seo.logoAssetId]);

  const configured =
    configuredKeys.has(SETTING_KEYS.shippingCents) &&
    configuredKeys.has(SETTING_KEYS.taxRateBp);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Values that change what the storefront charges and how it appears in search.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            Applied when an order is placed, and stored on the order itself —
            changing them here never rewrites an order that already exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrderSettingsForm
            shippingCents={money.shippingCents}
            taxRateBp={money.taxRateBp}
            configured={configured}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search &amp; social</CardTitle>
          <CardDescription>
            Site-wide defaults for search engines and share cards, and the
            switch that decides whether the store is indexed at all. Products
            and categories can override the page-level values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeoSettingsForm
            initial={seo}
            defaultOgImageUrl={seoImages.get(seo.defaultOgImageAssetId) ?? ""}
            logoUrl={seoImages.get(seo.logoAssetId) ?? ""}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrderSettingsForm } from "@/components/settings/order-settings-form";
import { getCurrentSession, isAdmin } from "@/lib/auth/session";
import {
  getConfiguredKeys,
  getOrderMoneySettings,
  SETTING_KEYS,
} from "@/lib/settings/store";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  const canEdit = !!session && isAdmin(session.user);

  const [money, configuredKeys] = await Promise.all([
    getOrderMoneySettings(),
    getConfiguredKeys(),
  ]);

  const configured =
    configuredKeys.has(SETTING_KEYS.shippingCents) &&
    configuredKeys.has(SETTING_KEYS.taxRateBp);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Values that change what the storefront charges.
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
    </div>
  );
}

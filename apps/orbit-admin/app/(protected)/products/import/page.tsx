import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/products/import-wizard";
import { getCurrentSession, isWriter } from "@/lib/auth/session";

export default async function ImportProductsPage() {
  // Import is bulk product editing, so it takes the same writer check.
  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) redirect("/products");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import products</h1>
        <p className="text-sm text-muted-foreground">
          Load products from a CSV or tab-separated export. Nothing is written
          until you confirm the preview.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}

import { redirect } from "next/navigation";

import { verifyMfaAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession, pendingMfaStep } from "@/lib/auth/session";

export default async function MfaVerifyPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/login");

  const step = pendingMfaStep(current.user, current.session.mfaVerified);
  if (step === null) redirect("/dashboard");
  if (step !== "/mfa") redirect(step);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-factor verification</CardTitle>
          <CardDescription>
            Enter the code from your authenticator app to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Placeholder step. This will be replaced by a one-time-code field.
          </p>
        </CardContent>
        <CardFooter>
          <form action={verifyMfaAction} className="w-full">
            <Button type="submit" className="w-full">
              Verify &amp; continue
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

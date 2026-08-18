import { redirect } from "next/navigation";

import { completeMfaEnrollmentAction } from "@/lib/auth/actions";
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

export default async function MfaEnrollPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/login");

  const step = pendingMfaStep(current.user, current.session.mfaVerified);
  if (step === null) redirect("/dashboard");
  if (step !== "/mfa/enroll") redirect(step);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up two-factor authentication</CardTitle>
          <CardDescription>
            Your account requires MFA. Full authenticator (TOTP) enrolment is
            coming soon — for now, continue to finish setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Placeholder step. This will be replaced by a QR code and a
            verification code field.
          </p>
        </CardContent>
        <CardFooter>
          <form action={completeMfaEnrollmentAction} className="w-full">
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

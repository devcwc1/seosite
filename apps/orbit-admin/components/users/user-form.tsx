"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createUserAction,
  updateUserAction,
} from "@/app/(protected)/users/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserAccountStatus, UserRole } from "@/lib/users/validation";

export type UserFormInitial = {
  id: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  mfaEnforced: boolean;
  mfaEnrolled: boolean;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function UserForm({
  mode,
  initial,
  isSelf = false,
}: {
  mode: "create" | "edit";
  initial?: UserFormInitial;
  /** True when editing your own account — you cannot disable yourself. */
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [values, setValues] = useState({
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? ("editor" as UserRole),
    mfaEnforced: initial?.mfaEnforced ?? true,
    resetMfaEnrollment: false,
    disabled: initial?.status === "disabled",
  });

  function set<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setErrors({});
      setFormError(null);

      const result =
        mode === "create"
          ? await createUserAction({
              email: values.email,
              password: values.password,
              role: values.role,
              mfaEnforced: values.mfaEnforced,
            })
          : await updateUserAction(initial!.id, {
              email: values.email,
              password: values.password,
              role: values.role,
              mfaEnforced: values.mfaEnforced,
              resetMfaEnrollment: values.resetMfaEnrollment,
              status: values.disabled ? "disabled" : "active",
            });

      if (result.ok) {
        router.push("/users");
        router.refresh();
      } else {
        setErrors(result.errors);
        setFormError(result.errors.form ?? "Please fix the errors below.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="off"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <FieldError message={errors.email} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">
              {mode === "create"
                ? "Password"
                : "New password (leave blank to keep current)"}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <FieldError message={errors.password} />
          </div>

          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="role">Role</Label>
            <Select
              value={values.role}
              onValueChange={(v) => set("role", (v ?? "editor") as UserRole)}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.role} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="mfaEnforced"
              checked={values.mfaEnforced}
              onCheckedChange={(c) => set("mfaEnforced", c === true)}
            />
            <Label htmlFor="mfaEnforced">Require multi-factor authentication</Label>
          </div>

          {mode === "edit" ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="resetMfa"
                checked={values.resetMfaEnrollment}
                onCheckedChange={(c) => set("resetMfaEnrollment", c === true)}
              />
              <Label htmlFor="resetMfa">
                Reset MFA enrolment{" "}
                <span className="text-muted-foreground">
                  (currently {initial?.mfaEnrolled ? "enrolled" : "not enrolled"})
                </span>
              </Label>
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="grid gap-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="disabled"
                  checked={values.disabled}
                  disabled={isSelf}
                  onCheckedChange={(c) => set("disabled", c === true)}
                />
                <Label htmlFor="disabled">Disable this account</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {isSelf
                  ? "You can't disable your own account."
                  : "A disabled user can't sign in, and any active sessions are ended immediately."}
              </p>
              <FieldError message={errors.status} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create user"
              : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/users")}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

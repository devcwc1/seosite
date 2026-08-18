import { redirect } from "next/navigation";

// The admin has no marketing home; the root sends you into the app. The
// (protected) layout then bounces to /login when there's no valid session.
export default function RootPage() {
  redirect("/dashboard");
}

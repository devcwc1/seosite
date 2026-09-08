import { MediaLibrary } from "@/components/media/media-library";
import { getCurrentSession, isWriter } from "@/lib/auth/session";

export default async function MediaPage() {
  const session = await getCurrentSession();
  const canWrite = !!session && isWriter(session.user);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
        <p className="text-sm text-muted-foreground">
          {canWrite
            ? "Upload and manage reusable image assets."
            : "Browse the reusable image assets."}
        </p>
      </div>
      <MediaLibrary canWrite={canWrite} />
    </div>
  );
}

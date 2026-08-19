import { MediaLibrary } from "@/components/media/media-library";

export default function MediaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
        <p className="text-sm text-muted-foreground">
          Upload and manage reusable image assets.
        </p>
      </div>
      <MediaLibrary />
    </div>
  );
}

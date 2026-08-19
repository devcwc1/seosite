import "server-only";

import { unlink } from "node:fs/promises";
import path from "node:path";

import { desc, eq, ilike, or } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { media, type Media } from "@/lib/db/schema";
import { saveUpload, uploadDir } from "@/lib/uploads";

import type { MediaDTO } from "./types";

export function toMediaDTO(row: Media): MediaDTO {
  return {
    id: row.id,
    url: `/api/uploads/${row.filename}`,
    filename: row.filename,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    alt: row.alt,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Store an uploaded file on disk and record it in the media library. */
export async function createMediaFromFile(
  file: File,
  actorId: string | null,
): Promise<MediaDTO> {
  const saved = await saveUpload(file);

  const [row] = await db
    .insert(media)
    .values({
      filename: saved.name,
      originalName: file.name || null,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedBy: actorId,
    })
    .returning();
  if (!row) throw new Error("Failed to record media");

  await recordAudit({
    actorId,
    action: "media.created",
    target: `media:${row.id}`,
    metadata: { filename: row.filename, sizeBytes: row.sizeBytes },
  });

  return toMediaDTO(row);
}

/** List media, newest first, optionally filtered by name/alt. */
export async function listMedia(query?: string): Promise<MediaDTO[]> {
  const q = query?.trim();
  const rows = q
    ? await db
        .select()
        .from(media)
        .where(
          or(
            ilike(media.originalName, `%${q}%`),
            ilike(media.alt, `%${q}%`),
            ilike(media.filename, `%${q}%`),
          ),
        )
        .orderBy(desc(media.createdAt))
        .limit(300)
    : await db.select().from(media).orderBy(desc(media.createdAt)).limit(300);

  return rows.map(toMediaDTO);
}

/** Delete a media row and remove its file from disk. */
export async function deleteMedia(
  id: string,
  actorId: string | null,
): Promise<{ ok: boolean }> {
  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.id, id))
    .limit(1);
  if (!row) return { ok: false };

  await db.delete(media).where(eq(media.id, id));
  await unlink(path.join(uploadDir(), row.filename)).catch(() => undefined);

  await recordAudit({
    actorId,
    action: "media.deleted",
    target: `media:${id}`,
    metadata: { filename: row.filename },
  });

  return { ok: true };
}

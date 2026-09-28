CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
-- Add nullable, backfill existing rows from the current expiry, then enforce
-- NOT NULL: an existing session's absolute cap is simply its current expiry.
ALTER TABLE "sessions" ADD COLUMN "absolute_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "sessions" SET "absolute_expires_at" = "expires_at" WHERE "absolute_expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "absolute_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;
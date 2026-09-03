CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"storage_key" varchar(512),
	"external_url" varchar(2048),
	"format" varchar(16) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"original_name" varchar(512),
	"original_mime_type" varchar(128),
	"alt" varchar(512),
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"alt" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_sha256_unique" ON "media_assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "media_assets_created_at_idx" ON "media_assets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_product_asset_unique" ON "product_media" USING btree ("product_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "product_media_product_position_idx" ON "product_media" USING btree ("product_id","position");
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_position_idx" ON "categories" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_unique" ON "product_categories" USING btree ("product_id","category_id");--> statement-breakpoint
CREATE INDEX "product_categories_category_idx" ON "product_categories" USING btree ("category_id");--> statement-breakpoint
/*
 * Backfill from the jsonb categories that lived on product_content.
 *
 * Every distinct slug becomes a category row (first name seen wins), and each
 * product is linked to the ones it listed, keeping whichever entry it marked
 * primary. The jsonb column stays where it is: this migration must be safe to
 * run against a live database, and dropping the old shape is a separate step
 * once nothing reads it.
 */
INSERT INTO "categories" ("slug", "name")
SELECT DISTINCT ON (c->>'slug') c->>'slug', c->>'name'
FROM "product_content" pc
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pc."categories", '[]'::jsonb)) AS c
WHERE COALESCE(c->>'slug', '') <> ''
ORDER BY c->>'slug', c->>'name'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

INSERT INTO "product_categories" ("product_id", "category_id", "is_primary")
SELECT DISTINCT ON (pc."product_id", cat."id")
       pc."product_id",
       cat."id",
       COALESCE((c->>'isPrimary')::boolean, false)
FROM "product_content" pc
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pc."categories", '[]'::jsonb)) AS c
JOIN "categories" cat ON cat."slug" = c->>'slug'
JOIN "products" p ON p."current_content_id" = pc."id"
ORDER BY pc."product_id", cat."id", COALESCE((c->>'isPrimary')::boolean, false) DESC
ON CONFLICT ("product_id", "category_id") DO NOTHING;

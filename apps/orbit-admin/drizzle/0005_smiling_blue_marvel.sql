CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'shipped', 'cancelled');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"title" varchar(512) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(32) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(64),
	"shipping_name" varchar(255) NOT NULL,
	"shipping_street" varchar(255) NOT NULL,
	"shipping_postcode" varchar(32) NOT NULL,
	"shipping_city" varchar(128) NOT NULL,
	"shipping_country" varchar(2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"payment_method" varchar(32) DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_unique" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
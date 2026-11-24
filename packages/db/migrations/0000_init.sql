CREATE TYPE "public"."call_mode" AS ENUM('live', 'cascade', 'cascade_paid');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('order', 'request', 'abandoned', 'error', 'capped');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('phone', 'web', 'staff');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('confirmed', 'picked_up', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."request_kind" AS ENUM('callback', 'change', 'cancel');--> statement-breakpoint
CREATE TYPE "public"."request_origin" AS ENUM('agent', 'promised_not_recorded', 'web');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "bakery_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"cutoff_days_before" integer NOT NULL,
	"cutoff_time" time NOT NULL,
	"closed_weekdays" integer[] NOT NULL,
	"call_cap_seconds" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caller_phone" text NOT NULL,
	"ip_hash" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"mode" "call_mode" DEFAULT 'live' NOT NULL,
	"outcome" "call_outcome",
	"first_audio_ms_p50" integer,
	"first_audio_ms_max" integer,
	"tokens_in" integer,
	"tokens_out" integer,
	"shadow_cost_usd" numeric,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"transcript" jsonb,
	"trace_id" text
);
--> statement-breakpoint
CREATE TABLE "closed_day" (
	"day" date PRIMARY KEY NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "daily_capacity" (
	"product_id" text NOT NULL,
	"day" date NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_capacity_product_id_day_pk" PRIMARY KEY("product_id","day")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer DEFAULT nextval('order_number_seq') NOT NULL,
	"source" "order_source" NOT NULL,
	"status" "order_status" DEFAULT 'confirmed' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"pickup_day" date NOT NULL,
	"total_czk" integer NOT NULL,
	"prompt_version" text,
	"model" text,
	"call_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "order_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "order_source" NOT NULL,
	"call_id" uuid,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"order_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_czk" integer NOT NULL,
	CONSTRAINT "order_line_order_id_product_id_pk" PRIMARY KEY("order_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"spoken_forms" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_czk" integer NOT NULL,
	"daily_limit" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "staff_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "request_kind" NOT NULL,
	"origin" "request_origin" NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"note" text NOT NULL,
	"call_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "walk_in_buffer" (
	"product_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "walk_in_buffer_product_id_weekday_pk" PRIMARY KEY("product_id","weekday")
);
--> statement-breakpoint
ALTER TABLE "daily_capacity" ADD CONSTRAINT "daily_capacity_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_confirmed_order_id_order_id_fk" FOREIGN KEY ("confirmed_order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_request" ADD CONSTRAINT "staff_request_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_in_buffer" ADD CONSTRAINT "walk_in_buffer_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;
CREATE TYPE "public"."request_outcome" AS ENUM('handled', 'unreachable');--> statement-breakpoint
CREATE TYPE "public"."request_step" AS ENUM('call_started', 'unanswered', 'handled', 'unreachable', 'reopened', 'order_cancelled');--> statement-breakpoint
CREATE TABLE "staff_request_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" text,
	"kind" "request_step" NOT NULL,
	"note" text,
	"order_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_request" ADD COLUMN "outcome" "request_outcome";--> statement-breakpoint
ALTER TABLE "staff_request" ADD COLUMN "claimed_by" text;--> statement-breakpoint
ALTER TABLE "staff_request" ADD COLUMN "claimed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_request_event" ADD CONSTRAINT "staff_request_event_request_id_staff_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."staff_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_request_event" ADD CONSTRAINT "staff_request_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_request_event" ADD CONSTRAINT "staff_request_event_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_request_event_history" ON "staff_request_event" USING btree ("request_id","at");--> statement-breakpoint
ALTER TABLE "staff_request" ADD CONSTRAINT "staff_request_claimed_by_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- requests closed before outcomes existed were handled (spec 001 FR-047)
UPDATE "staff_request" SET "outcome" = 'handled' WHERE "done_at" IS NOT NULL;

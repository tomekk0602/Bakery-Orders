ALTER TABLE "order_draft" DROP CONSTRAINT "order_draft_one_owner";--> statement-breakpoint
ALTER TABLE "order_draft" ADD COLUMN "web_token_hash" text;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_one_owner" CHECK (num_nonnulls("order_draft"."call_id", "order_draft"."created_by", "order_draft"."web_token_hash") = 1);
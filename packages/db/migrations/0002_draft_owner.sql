ALTER TABLE "order" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "order_draft" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_one_owner" CHECK (("order_draft"."call_id" IS NULL) <> ("order_draft"."created_by" IS NULL));
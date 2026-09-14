ALTER TABLE "backlog_items" ADD COLUMN "start_sprint_id" text;--> statement-breakpoint
ALTER TABLE "backlog_items" ADD COLUMN "target_sprint_id" text;--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_start_sprint_id_sprints_id_fk" FOREIGN KEY ("start_sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_target_sprint_id_sprints_id_fk" FOREIGN KEY ("target_sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;
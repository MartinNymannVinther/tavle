ALTER TABLE "backlog_items" DROP CONSTRAINT "backlog_items_done_when_ck";--> statement-breakpoint
ALTER TABLE "backlog_items" ADD COLUMN "start_quarter" text;--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_start_quarter_ck" CHECK ("backlog_items"."start_quarter" is null or "backlog_items"."start_quarter" ~ '^[0-9]{4}-Q[1-4]$');
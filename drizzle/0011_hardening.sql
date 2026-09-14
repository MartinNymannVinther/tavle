CREATE INDEX "cards_swimlane_idx" ON "cards" USING btree ("swimlane_id");--> statement-breakpoint
CREATE INDEX "backlog_items_start_sprint_idx" ON "backlog_items" USING btree ("start_sprint_id");--> statement-breakpoint
CREATE INDEX "backlog_items_target_sprint_idx" ON "backlog_items" USING btree ("target_sprint_id");--> statement-breakpoint
-- Rule 4's database backstop, in the form docs/adr/0018 left it: a closed
-- item keeps a done-when. NOT VALID guards new writes without judging
-- rows from the window where no check stood.
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_closed_done_when_ck" CHECK ("backlog_items"."state" <> 'closed' or btrim("backlog_items"."done_when") <> '') NOT VALID;--> statement-breakpoint
-- The undo already-undone check asks for payload->>'of' among a board's
-- undo.applied events; this answers it without walking the history.
CREATE INDEX "events_undo_of_idx" ON "events" ((payload->>'of')) WHERE "type" = 'undo.applied';

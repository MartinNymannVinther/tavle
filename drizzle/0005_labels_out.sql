-- Labels leave with the backlog structure (docs/adr/0011): what they were
-- used for is now a field with a meaning — the bug flag, the kind
-- (business or enabler), the theme and the area. Their audit rows stay;
-- the audit log is append-only and keeps the names.
DROP TABLE "card_labels" CASCADE;
--> statement-breakpoint
DROP TABLE "labels" CASCADE;

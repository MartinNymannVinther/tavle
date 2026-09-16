-- A release (docs/adr/0032): a named bundle of work delivered together,
-- and the story map's horizontal band. Deleting one frees its cards
-- rather than taking them with it, so a band can be removed without
-- losing work.
CREATE TABLE "releases" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"target_date" date,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "release_id" text;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "releases_board_name_uq" ON "releases" USING btree ("board_id",lower("name"));--> statement-breakpoint
CREATE INDEX "releases_board_idx" ON "releases" USING btree ("board_id","sort");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_release_idx" ON "cards" USING btree ("release_id");
--> statement-breakpoint

-- Security for the new table, the same shape as 0003, 0008 and 0012:
-- grant, forced row-level security keyed on org_id, one policy, audit.
GRANT SELECT, INSERT, UPDATE, DELETE ON "releases" TO tavle_app;
--> statement-breakpoint
ALTER TABLE "releases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "releases" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_tenant_releases ON "releases" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE TRIGGER audit_releases
  AFTER INSERT OR UPDATE OR DELETE ON "releases"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

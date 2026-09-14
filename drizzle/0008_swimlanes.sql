CREATE TABLE "swimlanes" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "swimlane_by" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "swimlane_id" text;--> statement-breakpoint
ALTER TABLE "swimlanes" ADD CONSTRAINT "swimlanes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swimlanes" ADD CONSTRAINT "swimlanes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "swimlanes_board_name_uq" ON "swimlanes" USING btree ("board_id",lower("name"));--> statement-breakpoint
CREATE INDEX "swimlanes_board_idx" ON "swimlanes" USING btree ("board_id","sort");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_swimlane_id_swimlanes_id_fk" FOREIGN KEY ("swimlane_id") REFERENCES "public"."swimlanes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_swimlane_by_ck" CHECK ("boards"."swimlane_by" in ('none', 'kind', 'theme', 'area', 'manual'));--> statement-breakpoint

-- Security for the new table, the same shape as 0003 and 0004: grant,
-- forced row-level security keyed on org_id, one policy, audit trigger.
GRANT SELECT, INSERT, UPDATE, DELETE ON "swimlanes" TO tavle_app;
--> statement-breakpoint
ALTER TABLE "swimlanes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "swimlanes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_tenant_swimlanes ON "swimlanes" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE TRIGGER audit_swimlanes
  AFTER INSERT OR UPDATE OR DELETE ON "swimlanes"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

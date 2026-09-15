-- The workspace's roster (docs/adr/0029): people work is assigned to,
-- with or without a login attached. Cards move their assignee from the
-- user to the person; the backfill makes one linked person per member
-- and carries every existing assignment across, so nothing is lost.
CREATE TABLE "people" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "people_org_user_uq" ON "people" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "people_org_idx" ON "people" USING btree ("org_id");--> statement-breakpoint

-- Security for the new table, the same shape as 0003 and 0008: grant,
-- forced row-level security keyed on org_id, one policy, audit trigger.
GRANT SELECT, INSERT, UPDATE, DELETE ON "people" TO tavle_app;
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "people" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_tenant_people ON "people" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE TRIGGER audit_people
  AFTER INSERT OR UPDATE OR DELETE ON "people"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint

-- Whatever door a login comes through — invitation, registration, the
-- demo — the membership insert is the one common fact, so the roster
-- adopts there: an unlinked person with the invited address takes the
-- login, anyone else gets a fresh linked person. SECURITY DEFINER
-- because Better Auth's role writes memberships without an org context.
CREATE FUNCTION people_adopt_member() RETURNS trigger AS $$
DECLARE
  u RECORD;
  adopted text;
BEGIN
  SELECT name, email INTO u FROM users WHERE id = NEW.user_id;
  IF u IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM people
             WHERE org_id = NEW.organization_id AND user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  UPDATE people SET user_id = NEW.user_id, updated_at = now()
  WHERE id = (SELECT id FROM people
              WHERE org_id = NEW.organization_id AND user_id IS NULL
                AND email IS NOT NULL AND lower(email) = lower(u.email)
              ORDER BY created_at LIMIT 1)
  RETURNING id INTO adopted;
  IF adopted IS NULL THEN
    INSERT INTO people (org_id, name, email, user_id)
    VALUES (NEW.organization_id, u.name, u.email, NEW.user_id);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;
--> statement-breakpoint
CREATE TRIGGER people_adopt_member
  AFTER INSERT ON "memberships"
  FOR EACH ROW EXECUTE FUNCTION people_adopt_member();
--> statement-breakpoint

-- One linked person per existing member, carrying the login's name and
-- address; then every card's assignee walks over to that person before
-- the old column goes.
INSERT INTO "people" ("org_id", "name", "email", "user_id")
SELECT m."organization_id", u."name", u."email", m."user_id"
FROM "memberships" m
JOIN "users" u ON u."id" = m."user_id";
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "assignee_person_id" text;--> statement-breakpoint
UPDATE "cards" c
SET "assignee_person_id" = p."id"
FROM "people" p
WHERE c."assignee_user_id" IS NOT NULL
  AND p."org_id" = c."org_id"
  AND p."user_id" = c."assignee_user_id";
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_assignee_person_id_people_id_fk" FOREIGN KEY ("assignee_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_assignee_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "cards_assignee_idx";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "assignee_user_id";--> statement-breakpoint
CREATE INDEX "cards_assignee_idx" ON "cards" USING btree ("assignee_person_id");

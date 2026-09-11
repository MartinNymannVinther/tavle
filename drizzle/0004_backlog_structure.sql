-- The backlog structure above the cards (docs/adr/0011): epics and
-- features in one table with one relation, the two closed lists theme and
-- area, the card's place in it, an item's own activity feed, and the
-- board's review setting. The label tables go in 0005, in a migration of
-- their own, so this one only adds.
CREATE TABLE "areas" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "backlog_item_themes" (
	"org_id" text NOT NULL,
	"item_id" text NOT NULL,
	"theme_id" text NOT NULL,
	CONSTRAINT "backlog_item_themes_item_id_theme_id_pk" PRIMARY KEY("item_id","theme_id")
);

--> statement-breakpoint
CREATE TABLE "backlog_items" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"board_id" text NOT NULL,
	"level" text NOT NULL,
	"parent_id" text,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"done_when" text NOT NULL,
	"kind" text DEFAULT 'business' NOT NULL,
	"enabler_type" text,
	"area_id" text,
	"state" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"target_quarter" text,
	"review_confirmed_at" timestamp with time zone,
	"sort" double precision DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backlog_items_level_ck" CHECK ("backlog_items"."level" in ('epic', 'feature')),
	CONSTRAINT "backlog_items_epic_has_no_parent_ck" CHECK ("backlog_items"."level" = 'feature' or "backlog_items"."parent_id" is null),
	CONSTRAINT "backlog_items_done_when_ck" CHECK ("backlog_items"."done_when" <> ''),
	CONSTRAINT "backlog_items_enabler_type_ck" CHECK ("backlog_items"."enabler_type" is null or "backlog_items"."kind" = 'enabler'),
	CONSTRAINT "backlog_items_target_quarter_ck" CHECK ("backlog_items"."target_quarter" is null or "backlog_items"."target_quarter" ~ '^[0-9]{4}-Q[1-4]$')
);

--> statement-breakpoint
CREATE TABLE "card_themes" (
	"org_id" text NOT NULL,
	"card_id" text NOT NULL,
	"theme_id" text NOT NULL,
	CONSTRAINT "card_themes_card_id_theme_id_pk" PRIMARY KEY("card_id","theme_id")
);

--> statement-breakpoint
CREATE TABLE "themes" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'moss' NOT NULL,
	"owner_user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "epic_review_days" integer DEFAULT 180 NOT NULL;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "feature_id" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "kind" text DEFAULT 'business' NOT NULL;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "enabler_type" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "area_id" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "bug" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "acceptance" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "item_id" text;
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_item_themes" ADD CONSTRAINT "backlog_item_themes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_item_themes" ADD CONSTRAINT "backlog_item_themes_item_id_backlog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."backlog_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_item_themes" ADD CONSTRAINT "backlog_item_themes_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_parent_id_backlog_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."backlog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "card_themes" ADD CONSTRAINT "card_themes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "card_themes" ADD CONSTRAINT "card_themes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "card_themes" ADD CONSTRAINT "card_themes_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "areas_board_name_uq" ON "areas" USING btree ("board_id",lower("name"));
--> statement-breakpoint
CREATE INDEX "areas_board_idx" ON "areas" USING btree ("board_id","sort");
--> statement-breakpoint
CREATE UNIQUE INDEX "backlog_items_board_number_uq" ON "backlog_items" USING btree ("board_id","number");
--> statement-breakpoint
CREATE INDEX "backlog_items_board_level_idx" ON "backlog_items" USING btree ("board_id","level","sort");
--> statement-breakpoint
CREATE INDEX "backlog_items_parent_idx" ON "backlog_items" USING btree ("parent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "themes_board_name_uq" ON "themes" USING btree ("board_id",lower("name"));
--> statement-breakpoint
CREATE INDEX "themes_board_idx" ON "themes" USING btree ("board_id","sort");
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_feature_id_backlog_items_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."backlog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_item_id_backlog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."backlog_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cards_feature_idx" ON "cards" USING btree ("feature_id");
--> statement-breakpoint
CREATE INDEX "events_item_idx" ON "events" USING btree ("item_id","created_at");
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_enabler_type_ck" CHECK ("cards"."enabler_type" is null or "cards"."kind" = 'enabler');
--> statement-breakpoint

-- Security for the new tables, the same shape as 0003: grants, forced
-- row-level security keyed on org_id, one policy per table, audit
-- triggers on everything a workspace owns.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "themes", "areas", "backlog_items", "backlog_item_themes", "card_themes"
TO tavle_app;
--> statement-breakpoint
ALTER TABLE "themes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "themes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "areas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "areas" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "backlog_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "backlog_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "backlog_item_themes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "backlog_item_themes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_themes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_themes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_tenant_themes ON "themes" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_areas ON "areas" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_backlog_items ON "backlog_items" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_backlog_item_themes ON "backlog_item_themes" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_card_themes ON "card_themes" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE TRIGGER audit_themes
  AFTER INSERT OR UPDATE OR DELETE ON "themes"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_areas
  AFTER INSERT OR UPDATE OR DELETE ON "areas"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_backlog_items
  AFTER INSERT OR UPDATE OR DELETE ON "backlog_items"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_backlog_item_themes
  AFTER INSERT OR UPDATE OR DELETE ON "backlog_item_themes"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_card_themes
  AFTER INSERT OR UPDATE OR DELETE ON "card_themes"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint

-- Rule 1 of the structure, in the database as well as in the service: a
-- parent is exactly one level up and on the same board. A feature's
-- parent is an epic; a card's parent is a feature. The lookups run under
-- the caller's row-level security, so a parent in another workspace is
-- simply not found, which is the right answer.
CREATE OR REPLACE FUNCTION backlog_item_parent_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_level text;
  v_board text;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'backlog_items: an item cannot be its own parent' USING ERRCODE = 'check_violation';
  END IF;
  SELECT level, board_id INTO v_level, v_board FROM backlog_items WHERE id = NEW.parent_id;
  IF v_level IS NULL THEN
    RAISE EXCEPTION 'backlog_items: parent not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.level <> 'feature' OR v_level <> 'epic' OR v_board <> NEW.board_id THEN
    RAISE EXCEPTION 'backlog_items: a parent is exactly one level up, on the same board' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER backlog_items_parent_check
  BEFORE INSERT OR UPDATE OF parent_id, level, board_id ON "backlog_items"
  FOR EACH ROW EXECUTE FUNCTION backlog_item_parent_check();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION card_feature_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_level text;
  v_board text;
BEGIN
  IF NEW.feature_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT level, board_id INTO v_level, v_board FROM backlog_items WHERE id = NEW.feature_id;
  IF v_level IS NULL THEN
    RAISE EXCEPTION 'cards: feature not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_level <> 'feature' OR v_board <> NEW.board_id THEN
    RAISE EXCEPTION 'cards: a card is part of a feature on its own board' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER cards_feature_check
  BEFORE INSERT OR UPDATE OF feature_id, board_id ON "cards"
  FOR EACH ROW EXECUTE FUNCTION card_feature_check();

ALTER TABLE "boards" ADD COLUMN "structure_levels" text DEFAULT 'epic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "show_kind" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "show_themes" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "show_areas" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_structure_levels_ck" CHECK ("boards"."structure_levels" in ('epic', 'feature', 'card'));
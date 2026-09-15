-- What the team counts in (docs/adr/0030). One integer on the card
-- carries points, hours or a T-shirt size, so every sum the product
-- computes keeps working; the column only says how to read it. Every
-- existing board keeps counting exactly as it did.
ALTER TABLE "boards" ADD COLUMN "estimate_unit" text DEFAULT 'points' NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_estimate_unit_ck" CHECK ("boards"."estimate_unit" in ('points', 'hours', 'tshirt'));

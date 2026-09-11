-- Security for the product tables: grants, forced row-level security keyed
-- on org_id, audit triggers, and the one privileged operation the
-- application role is allowed: deleting a whole workspace. See docs/adr/0007.

-- The application role owns the product tables in the only sense that
-- matters: it may read and write them, and RLS decides which rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "boards", "columns", "labels", "sprints", "cards", "card_labels", "comments", "card_transitions", "events"
TO tavle_app;
--> statement-breakpoint
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "boards" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "columns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "columns" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "labels" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sprints" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sprints" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cards" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_labels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_labels" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "comments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_transitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_transitions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- One policy per table: rows of the active workspace, nothing else, for
-- reads and writes alike. Without a context every predicate is NULL.
CREATE POLICY app_tenant_boards ON "boards" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_columns ON "columns" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_labels ON "labels" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_sprints ON "sprints" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_cards ON "cards" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_card_labels ON "card_labels" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_comments ON "comments" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_card_transitions ON "card_transitions" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_events ON "events" FOR ALL TO tavle_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint

-- Audit triggers on every table that holds what a workspace owns. events
-- and card_transitions are excluded: both are logs themselves, and
-- auditing a log is a copy, not a record (docs/adr/0003, 0005).
CREATE TRIGGER audit_boards
  AFTER INSERT OR UPDATE OR DELETE ON "boards"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_columns
  AFTER INSERT OR UPDATE OR DELETE ON "columns"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_labels
  AFTER INSERT OR UPDATE OR DELETE ON "labels"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_sprints
  AFTER INSERT OR UPDATE OR DELETE ON "sprints"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_cards
  AFTER INSERT OR UPDATE OR DELETE ON "cards"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_card_labels
  AFTER INSERT OR UPDATE OR DELETE ON "card_labels"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_comments
  AFTER INSERT OR UPDATE OR DELETE ON "comments"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint

-- Deleting a workspace: the one thing the application role may do that RLS
-- and grants would otherwise forbid, wrapped in a function that checks the
-- caller itself. Dogma 3 says everything a workspace owns can be deleted
-- again completely, and that includes the audit rows about it: they carry
-- the names and texts of the cards, and a team that leaves must not leave
-- a shadow. The append-only guard is stepped around for exactly this
-- transaction, and one context-free row records that the deletion happened.
CREATE OR REPLACE FUNCTION delete_workspace(p_org_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user text := nullif(current_setting('app.user_id', true), '');
  v_role text;
BEGIN
  IF p_org_id IS NULL OR p_org_id <> nullif(current_setting('app.org_id', true), '') THEN
    RAISE EXCEPTION 'delete_workspace: not the active workspace';
  END IF;
  SELECT role INTO v_role FROM memberships WHERE organization_id = p_org_id AND user_id = v_user;
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'delete_workspace: only the workspace owner may delete it';
  END IF;

  -- Domain rows, memberships and invitations follow the organization
  -- through cascading foreign keys; their audit rows are written by the
  -- triggers on the way out and purged just below.
  DELETE FROM organizations WHERE id = p_org_id;

  PERFORM set_config('session_replication_role', 'replica', true);
  DELETE FROM audit_log WHERE org_id = p_org_id;
  PERFORM set_config('session_replication_role', 'origin', true);

  INSERT INTO audit_log (org_id, actor_user_id, actor_type, action, entity_type, entity_id)
  VALUES (NULL, v_user, 'user', 'workspace.deleted', 'organizations', p_org_id);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION delete_workspace(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION delete_workspace(text) TO tavle_app;

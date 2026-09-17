-- The refusal gets a code, so the application stops reading the wording.
--
-- `delete_workspace()` refuses a non-owner by raising, and
-- src/modules/export/workspace.ts told the person which refusal it was by
-- matching the exception's *text*: `only the workspace owner`. A later
-- CREATE OR REPLACE that reworded the sentence — this migration, for
-- instance — would have turned "you are not the owner" into a nameless
-- failure, and no test would have said a word. So the owner check raises
-- with ERRCODE = '42501' (insufficient_privilege), which is what the
-- application matches now, and the wording is free to change again.
--
-- The active-workspace check above it keeps plpgsql's default P0001 on
-- purpose. It is a backstop against a call the application cannot make
-- (it passes the context's own org id), and giving it the same code would
-- report it to the person as "you are not the owner", which it is not.
--
-- The body is otherwise what 0003 left, down to the comments, and
-- CREATE OR REPLACE keeps the REVOKE and GRANT that stand under it there.
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
    RAISE EXCEPTION 'delete_workspace: only the workspace owner may delete it'
      USING ERRCODE = '42501';
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

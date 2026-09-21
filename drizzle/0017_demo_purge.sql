-- The demo's twenty-four hours, kept.
--
-- The demo screen promises that a demo workspace "slettes helt efter 24
-- timer, konto inklusive". Until now the cleanup deleted the organization
-- and the throwaway user and stopped there, so everything the visitor had
-- typed stayed behind in audit_log — card titles, descriptions, comments,
-- carried in the trigger's row images — together with the audit rows about
-- the account itself. A promise the product does not keep is worse than a
-- promise it never made.
--
-- `delete_workspace()` (0003) already does the right thing for an ordinary
-- workspace: dogma 3 says a workspace can be deleted completely, audit
-- rows included, because they hold the names and texts of the cards and a
-- team that leaves must not leave a shadow. The demo could not use it. It
-- checks that the caller is the owner of the active workspace, and the
-- cleanup runs with no session and no org context at all — it is a timer,
-- not a person. So the demo gets its own door, with its own guard.
--
-- The exception this writes down, and its bounds: the audit log is not
-- weakened for anybody. This function can delete exactly one kind of
-- workspace — one that is registered in demo_workspaces — and only after
-- its time is up. A workspace a team works in is not in that table and
-- never was, so there is no argument of this function that reaches one.
-- The guard is the table, not the caller's word for it.
CREATE OR REPLACE FUNCTION delete_demo_workspace(p_org_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user text;
  v_accounts text[];
BEGIN
  -- Both halves of the guard in one lookup: a demo, and an expired one.
  -- The service selects expired rows before it calls; this is the same
  -- rule again in the database, where it cannot be argued with.
  SELECT user_id INTO v_user
  FROM demo_workspaces
  WHERE organization_id = p_org_id AND expires_at < now();
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  -- Read before the delete: after it, nothing says which credential rows
  -- were this account's, and their audit rows are found by id.
  v_accounts := ARRAY(SELECT id FROM accounts WHERE user_id = v_user);

  -- Domain rows, the membership and the demo_workspaces row itself follow
  -- the organization through cascading foreign keys; the account's
  -- sessions and credentials follow the user. Their audit rows are
  -- written by the triggers on the way out and purged just below.
  DELETE FROM organizations WHERE id = p_org_id;
  DELETE FROM users WHERE id = v_user;

  PERFORM set_config('session_replication_role', 'replica', true);
  -- Everything the visitor wrote. One index scan on audit_log_org_created_idx.
  DELETE FROM audit_log WHERE org_id = p_org_id;
  -- And the shadow of the account itself, which is context-free and so
  -- carries no org_id to be found by: what it did outside the workspace,
  -- and the rows about its own creation and deletion. Kept to org_id IS
  -- NULL on purpose — with that, no argument to this function can reach
  -- another workspace's audit trail even if one of the ids below were
  -- somehow shared.
  DELETE FROM audit_log WHERE org_id IS NULL AND actor_user_id = v_user;
  DELETE FROM audit_log
  WHERE org_id IS NULL AND entity_type = 'users' AND entity_id = v_user;
  DELETE FROM audit_log
  WHERE org_id IS NULL AND entity_type = 'accounts' AND entity_id = ANY(v_accounts);
  PERFORM set_config('session_replication_role', 'origin', true);

  -- One context-free row is left, the same shape delete_workspace leaves:
  -- that a demo expired and was removed, named by an id that now belongs
  -- to nothing. It is how an installation can see the cleanup running,
  -- and it carries not one word the visitor wrote.
  INSERT INTO audit_log (org_id, actor_user_id, actor_type, action, entity_type, entity_id)
  VALUES (NULL, NULL, 'system', 'demo.expired', 'organizations', p_org_id);

  RETURN true;
END
$$;--> statement-breakpoint

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which for a
-- definer's-rights function is a grant nobody wrote down. The cleanup runs
-- on the auth pool, because it runs before and outside every org context;
-- tavle_app has no business here and is not given any.
REVOKE ALL ON FUNCTION delete_demo_workspace(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION delete_demo_workspace(text) TO tavle_auth;--> statement-breakpoint

-- Of the four deletes above, three are index scans already: the first on
-- audit_log_org_created_idx, the two by entity on audit_log_entity_idx.
-- The fourth — what the account did outside any workspace — is found by
-- actor, and nothing indexes that. Without this it would be a sequential
-- scan of a table that is never pruned, run for every expired demo on
-- every visit to the demo door. Partial on purpose: the rows with no
-- org_id are the auth events and the account rows, a small corner of the
-- table, and the index is the size of that corner.
CREATE INDEX "audit_log_actor_no_org_idx" ON "audit_log" USING btree ("actor_user_id")
  WHERE "org_id" IS NULL;

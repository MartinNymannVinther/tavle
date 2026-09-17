-- The installation's own ceiling on model calls (docs/adr/0035).
--
-- The two ceilings in src/modules/ai/limits.ts are both counted inside a
-- tenant context, so neither can see past the workspace it is counting.
-- A person in three workspaces therefore has three times the per-user
-- ceiling, and an installation running DEMO=on — where every visitor gets
-- a workspace, and every workspace its own 600 a day — has no total at
-- all. The number this function returns is that total.
--
-- SECURITY DEFINER, owned by the migration role, so the count crosses the
-- tenant boundary while the rows never do: the application role still sees
-- only its own workspace's ai_calls rows under the forced RLS policy from
-- 0001, and gains exactly one number it could not otherwise compute. No
-- parameters, so there is nothing to aim it with; it can answer one
-- question and only that one. Same shape of exception as delete_workspace
-- in 0003 — a named function that steps outside RLS on purpose, rather
-- than a role that steps outside it everywhere.
--
-- STABLE, not IMMUTABLE: it reads a table and now(). A SQL-language body
-- would be inlined by the planner if it were not SECURITY DEFINER, which
-- would run it as the caller and quietly return zero; prosecdef blocks
-- inlining, and the test in tests/ai/limits.test.ts proves the number
-- crosses workspaces rather than trusting that.
CREATE OR REPLACE FUNCTION ai_calls_last_day() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM ai_calls WHERE created_at > now() - interval '1 day';
$$;--> statement-breakpoint

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which for a
-- definer's-rights function is a grant nobody wrote down. Say who may
-- call it instead.
REVOKE ALL ON FUNCTION ai_calls_last_day() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION ai_calls_last_day() TO tavle_app;--> statement-breakpoint

-- ai_calls' only index leads with user_id, which is no use to a count
-- over every workspace's last day. Without this the count is a sequential
-- scan of a table that is never pruned, run before every model call.
-- Narrow on purpose: once the ceiling holds, the rows inside the window
-- are bounded by the ceiling itself.
CREATE INDEX "ai_calls_created_idx" ON "ai_calls" USING btree ("created_at");

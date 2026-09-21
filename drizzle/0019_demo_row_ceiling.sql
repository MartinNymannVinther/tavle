-- A demo may be filled, but not without end.
--
-- The demo door is bounded twice (src/modules/demo/quota.ts): what one
-- address may build, and how many demos may live at once. Neither says
-- anything about what happens after a visitor is inside. A demo
-- workspace is an ordinary workspace to every service in the app, so a
-- script that has been through the door once can create cards in a loop
-- for the twenty-four hours the workspace lives, and two hundred live
-- demos doing that is a database nobody chose to fill.
--
-- The bound goes here rather than in a service because a service can be
-- forgotten. There are several ways a row is created — an action, the
-- seed, the AI apply, an undo — and a rule that has to be remembered at
-- each of them is a rule that will be missed at the next one. In the
-- database it is simply true, the same way rules 1, 4 and 5 of the
-- backlog structure are refused twice.
--
-- What it costs an ordinary workspace: one index probe of a tiny table
-- per insert, and nothing else. `demo_workspaces` holds at most
-- MAX_LIVE_DEMOS rows, its organization_id is unique, and a workspace a
-- team works in is not in it — so the count below never runs for them.
-- SECURITY DEFINER, and this is the reason: the trigger fires on inserts
-- made by `tavle_app`, which has no privilege on `demo_workspaces` and
-- must not be given one — the demo registry is the auth role's table.
-- Running as the owner lets the trigger ask the one question it needs to
-- ask. It is a trigger function, so nothing can call it directly; the
-- meta-test in tests/rls excludes trigger functions for exactly that
-- reason, and this one takes no argument that could reach another
-- workspace.
CREATE OR REPLACE FUNCTION demo_row_ceiling() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit integer := TG_ARGV[0]::integer;
  v_count bigint;
BEGIN
  -- The cheap half first: almost every insert in this installation is
  -- not a demo's, and for those this is where it ends.
  IF NOT EXISTS (SELECT 1 FROM demo_workspaces WHERE organization_id = NEW.org_id) THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT count(*) FROM %I WHERE org_id = $1', TG_TABLE_NAME)
    INTO v_count USING NEW.org_id;
  IF v_count >= v_limit THEN
    -- The same shape the other refusals use, so the application can tell
    -- this apart from a failure. A demo is for trying the product; being
    -- told the sandbox is full is the honest end of trying it.
    RAISE EXCEPTION 'demo workspace is full' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

-- The numbers are generous for a person and mean for a script. The demo
-- seed writes roughly sixty cards across its two boards, so a visitor has
-- room for several hundred of their own before anything says no.
CREATE TRIGGER demo_card_ceiling BEFORE INSERT ON cards
  FOR EACH ROW EXECUTE FUNCTION demo_row_ceiling('500');--> statement-breakpoint
CREATE TRIGGER demo_item_ceiling BEFORE INSERT ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION demo_row_ceiling('300');--> statement-breakpoint
CREATE TRIGGER demo_comment_ceiling BEFORE INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION demo_row_ceiling('500');

-- Draft 0023: transactionally maintained project/portfolio revisions.
-- NEVER apply to production until every existing write path and RLS policy is tested.
-- These revisions are maintained for all UPDATE statements, not only GAIZ.
ALTER TABLE public.projects
  ADD COLUMN revision integer NOT NULL DEFAULT 0
  CONSTRAINT projects_revision_nonnegative CHECK (revision >= 0);
ALTER TABLE public.portfolios
  ADD COLUMN revision integer NOT NULL DEFAULT 0
  CONSTRAINT portfolios_revision_nonnegative CHECK (revision >= 0);

-- The application cannot suppress revision increments by writing revision directly.
-- BEFORE UPDATE fires under ordinary project and portfolio updates (including
-- non-GAIZ flows). Transaction rollback restores both row and revision.
CREATE FUNCTION public.gaiz_bump_entity_revision() RETURNS trigger
LANGUAGE plpgsql
AS $gaiz_revision$
BEGIN
  IF OLD.revision >= 2147483647 THEN
    RAISE EXCEPTION 'entity revision exhausted' USING ERRCODE = '22003';
  END IF;
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$gaiz_revision$;

CREATE TRIGGER projects_gaiz_revision_on_update
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.gaiz_bump_entity_revision();
CREATE TRIGGER portfolios_gaiz_revision_on_update
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.gaiz_bump_entity_revision();

-- The app must not be able to reset the revision via arbitrary direct INSERT.
-- Existing INSERT privileges remain unchanged; all newly created rows start at 0.
-- This migration is intentionally unapplied and has no import write path.

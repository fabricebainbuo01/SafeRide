-- =====================================================
-- Business Intelligence support
-- =====================================================
-- Adds:
--   * leads_tracking — every "Confirm via WhatsApp" click → 1 lead → 300 XAF commission
--   * page_views     — Total Traffic counter for the Super Admin BI dashboard
--   * agencies.subscription_status — Paid / Overdue badge
--   * agency_routes.is_featured     — manually promote agencies that pay for visibility
--
-- All policies and the agency_routes trigger are created idempotently.
-- =====================================================

-- ------------------------------------------------------------------
-- 1) leads_tracking
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Every monetisable interaction with a booking is a "lead" (300 XAF each):
  --   * whatsapp_confirm — passenger clicks "Confirm via WhatsApp"
  --   * ticket_download  — passenger downloads the PDF ticket
  --   * ticket_print     — passenger prints the ticket / booking confirmation
  --   * qr_scan          — counter staff scans the QR code on a ticket
  -- Add new surfaces with a single ALTER on the CHECK constraint below.
  kind TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  group_code TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop any pre-existing CHECK on `kind` (e.g. an older single-value version of
-- this migration) and re-create it with the four current surfaces. Defensive
-- pg_constraint scan keeps the migration idempotent across re-runs.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.leads_tracking'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.leads_tracking DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.leads_tracking
  ADD CONSTRAINT leads_tracking_kind_check
  CHECK (kind IN (
    'whatsapp_confirm',
    'ticket_download',
    'ticket_print',
    'qr_scan'
  ));

CREATE INDEX IF NOT EXISTS idx_leads_kind_created
  ON public.leads_tracking(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_agency
  ON public.leads_tracking(agency_id);

ALTER TABLE public.leads_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_insert_anyone ON public.leads_tracking;
CREATE POLICY leads_insert_anyone ON public.leads_tracking
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS leads_select_super ON public.leads_tracking;
CREATE POLICY leads_select_super ON public.leads_tracking
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS leads_select_agency ON public.leads_tracking;
CREATE POLICY leads_select_agency ON public.leads_tracking
  FOR SELECT USING (
    agency_id IS NOT NULL
    AND agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  );

-- ------------------------------------------------------------------
-- 2) page_views (Total Traffic)
-- ------------------------------------------------------------------
-- INSERT-only for everyone (anon allowed); read restricted to super_admin.
-- Anonymous traffic must be countable, so we deliberately don't bind the
-- INSERT policy to auth.uid().
CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at
  ON public.page_views(created_at DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS page_views_insert_anyone ON public.page_views;
CREATE POLICY page_views_insert_anyone ON public.page_views
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS page_views_select_super ON public.page_views;
CREATE POLICY page_views_select_super ON public.page_views
  FOR SELECT USING (public.is_super_admin());

-- ------------------------------------------------------------------
-- 3) agencies.subscription_status
-- ------------------------------------------------------------------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'paid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_subscription_status_check'
  ) THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_subscription_status_check
      CHECK (subscription_status IN ('paid', 'overdue'));
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 4) agency_routes.is_featured
-- ------------------------------------------------------------------
ALTER TABLE public.agency_routes
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agency_routes_featured
  ON public.agency_routes(is_featured)
  WHERE is_featured = true;

-- ------------------------------------------------------------------
-- 5) Lock is_featured to super_admin
-- ------------------------------------------------------------------
-- Replace the existing agency_routes_before_write to:
--  * always reset is_featured to false on agency-staff inserts
--  * silently revert is_featured changes on agency-staff updates
-- Super-admins keep full control.
CREATE OR REPLACE FUNCTION public.agency_routes_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_super_admin() THEN
      NEW.verification_status := 'pending';
      NEW.verified_by := NULL;
      NEW.verified_at := NULL;
      NEW.rejection_reason := NULL;
      NEW.is_featured := false;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public.is_super_admin() THEN
      IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
        RAISE EXCEPTION 'agency_routes.agency_id is immutable';
      END IF;
      -- Agencies cannot self-promote to "Featured"; super_admin only.
      IF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
        NEW.is_featured := OLD.is_featured;
      END IF;
    END IF;

    IF public.is_super_admin() THEN
      RETURN NEW;
    END IF;

    IF OLD.verification_status IN ('pending', 'rejected') THEN
      NEW.verification_status := 'pending';
      NEW.verified_by := NULL;
      NEW.verified_at := NULL;
      NEW.rejection_reason := NULL;
    ELSIF OLD.verification_status = 'verified' THEN
      IF NEW.origin_city_id IS DISTINCT FROM OLD.origin_city_id
         OR NEW.destination_city_id IS DISTINCT FROM OLD.destination_city_id
         OR NEW.route_kind IS DISTINCT FROM OLD.route_kind
         OR NEW.stop_over_notes IS DISTINCT FROM OLD.stop_over_notes
         OR NEW.indicative_price_xaf IS DISTINCT FROM OLD.indicative_price_xaf
      THEN
        NEW.verification_status := 'pending';
        NEW.verified_by := NULL;
        NEW.verified_at := NULL;
      ELSE
        NEW.verification_status := 'verified';
        NEW.verified_by := OLD.verified_by;
        NEW.verified_at := OLD.verified_at;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_agency_routes_before_write ON public.agency_routes;
CREATE TRIGGER trigger_agency_routes_before_write
  BEFORE INSERT OR UPDATE ON public.agency_routes
  FOR EACH ROW EXECUTE FUNCTION public.agency_routes_before_write();

-- Agency-owned route listings (origin/destination pairs) with moderator verification before public visibility.

CREATE TABLE IF NOT EXISTS public.agency_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  origin_city_id UUID NOT NULL REFERENCES public.cities(id),
  destination_city_id UUID NOT NULL REFERENCES public.cities(id),
  route_kind TEXT NOT NULL CHECK (route_kind IN ('bus', 'camrail')),
  stop_over_notes TEXT,
  indicative_price_xaf INTEGER CHECK (indicative_price_xaf IS NULL OR indicative_price_xaf >= 0),
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (origin_city_id <> destination_city_id),
  UNIQUE (agency_id, origin_city_id, destination_city_id, route_kind)
);

CREATE INDEX IF NOT EXISTS idx_agency_routes_agency ON public.agency_routes(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_routes_verification ON public.agency_routes(verification_status);
CREATE INDEX IF NOT EXISTS idx_agency_routes_public ON public.agency_routes(verification_status, is_active)
  WHERE verification_status = 'verified' AND is_active = true;

DROP TRIGGER IF EXISTS set_agency_routes_updated_at ON public.agency_routes;
CREATE TRIGGER set_agency_routes_updated_at
  BEFORE UPDATE ON public.agency_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public.is_super_admin() THEN
      IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
        RAISE EXCEPTION 'agency_routes.agency_id is immutable';
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

ALTER TABLE public.agency_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY agency_routes_select_verified_public ON public.agency_routes
  FOR SELECT USING (verification_status = 'verified' AND is_active = true);

CREATE POLICY agency_routes_select_staff ON public.agency_routes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = agency_routes.agency_id
    )
  );

CREATE POLICY agency_routes_insert_staff ON public.agency_routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = agency_routes.agency_id
    )
  );

CREATE POLICY agency_routes_update_staff ON public.agency_routes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = agency_routes.agency_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = agency_routes.agency_id
    )
  );

CREATE POLICY agency_routes_delete_staff ON public.agency_routes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = agency_routes.agency_id
    )
  );

CREATE POLICY agency_routes_super_admin_all ON public.agency_routes
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());



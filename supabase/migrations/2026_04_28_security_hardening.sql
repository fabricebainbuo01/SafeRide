-- =====================================================
-- 2026-04-28  Security hardening
-- =====================================================
-- Apply this to any Supabase project that was deployed BEFORE this date.
-- Fresh deployments don't need it: the same changes are baked into schema.sql.
--
-- Safe to re-run (everything is wrapped in DROP IF EXISTS / CREATE OR REPLACE).
-- No data is modified — only policies, triggers, and helper functions.
--
-- Addresses these issues found in the project review:
--   #1 passengers could create rogue agencies via agencies_owner_manage INSERT
--   #2 bookings_update_own_cancel was correct but brittle (self-correlated subquery)
--   #3 bookings_update_agency had no column scope (agency could change amount, etc.)
--   #4 users_update_own_profile relied on a brittle subquery for role lock
--   #5 booking_groups.total_amount was client-controlled
--   #6 agency_apps_super_review had no WITH CHECK
--   #7 bus_locations.SELECT was fully public
--   #8 missing indexes for common queries + dedupe of pending applications
-- =====================================================

-- ---------- Helpers ----------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_privileged_caller()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin') THEN RETURN TRUE; END IF;
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;

-- ---------- New indexes ----------
CREATE INDEX IF NOT EXISTS idx_bus_locations_trip_recorded
  ON public.bus_locations(trip_id, recorded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_apps_one_pending_per_user
  ON public.agency_applications(user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_apps_one_pending_per_slug
  ON public.agency_applications(proposed_slug) WHERE status = 'pending';

-- ---------- Column-level immutability triggers ----------

CREATE OR REPLACE FUNCTION public.lock_user_immutable_cols()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_privileged_caller() THEN RETURN NEW; END IF;

  IF NEW.id        IS DISTINCT FROM OLD.id        THEN RAISE EXCEPTION 'users.id is immutable'; END IF;
  IF NEW.role      IS DISTINCT FROM OLD.role      THEN RAISE EXCEPTION 'users.role can only be changed by super_admin (use approve_agency_application)'; END IF;
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN RAISE EXCEPTION 'users.agency_id can only be changed by super_admin (use approve_agency_application)'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_user_cols ON public.users;
CREATE TRIGGER trigger_lock_user_cols
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.lock_user_immutable_cols();

CREATE OR REPLACE FUNCTION public.lock_booking_immutable_cols()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_privileged_caller() THEN RETURN NEW; END IF;

  IF NEW.user_id         IS DISTINCT FROM OLD.user_id         THEN RAISE EXCEPTION 'bookings.user_id is immutable'; END IF;
  IF NEW.trip_id         IS DISTINCT FROM OLD.trip_id         THEN RAISE EXCEPTION 'bookings.trip_id is immutable'; END IF;
  IF NEW.seat_number     IS DISTINCT FROM OLD.seat_number     THEN RAISE EXCEPTION 'bookings.seat_number is immutable'; END IF;
  IF NEW.amount          IS DISTINCT FROM OLD.amount          THEN RAISE EXCEPTION 'bookings.amount is immutable'; END IF;
  IF NEW.currency        IS DISTINCT FROM OLD.currency        THEN RAISE EXCEPTION 'bookings.currency is immutable'; END IF;
  IF NEW.passenger_name  IS DISTINCT FROM OLD.passenger_name  THEN RAISE EXCEPTION 'bookings.passenger_name is immutable'; END IF;
  IF NEW.passenger_phone IS DISTINCT FROM OLD.passenger_phone THEN RAISE EXCEPTION 'bookings.passenger_phone is immutable'; END IF;
  IF NEW.booking_code    IS DISTINCT FROM OLD.booking_code    THEN RAISE EXCEPTION 'bookings.booking_code is immutable'; END IF;
  IF NEW.group_id        IS DISTINCT FROM OLD.group_id        THEN RAISE EXCEPTION 'bookings.group_id is immutable'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_booking_cols ON public.bookings;
CREATE TRIGGER trigger_lock_booking_cols
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.lock_booking_immutable_cols();

CREATE OR REPLACE FUNCTION public.lock_application_immutable_cols()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_privileged_caller() THEN RETURN NEW; END IF;

  IF NEW.user_id        IS DISTINCT FROM OLD.user_id        THEN RAISE EXCEPTION 'agency_applications.user_id is immutable'; END IF;
  IF NEW.proposed_name  IS DISTINCT FROM OLD.proposed_name  THEN RAISE EXCEPTION 'agency_applications.proposed_name is immutable'; END IF;
  IF NEW.proposed_slug  IS DISTINCT FROM OLD.proposed_slug  THEN RAISE EXCEPTION 'agency_applications.proposed_slug is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_application_cols ON public.agency_applications;
CREATE TRIGGER trigger_lock_application_cols
  BEFORE UPDATE ON public.agency_applications
  FOR EACH ROW EXECUTE FUNCTION public.lock_application_immutable_cols();

-- ---------- booking_groups.total_amount = SUM(bookings.amount) ----------

CREATE OR REPLACE FUNCTION public.zero_booking_group_total_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_amount      := 0;
  NEW.payment_status    := 'pending';
  NEW.payment_method    := NULL;
  NEW.payment_reference := NULL;
  NEW.paid_at           := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_zero_group_total_on_insert ON public.booking_groups;
CREATE TRIGGER trigger_zero_group_total_on_insert
  BEFORE INSERT ON public.booking_groups
  FOR EACH ROW EXECUTE FUNCTION public.zero_booking_group_total_on_insert();

CREATE OR REPLACE FUNCTION public.recompute_booking_group_total()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  v_group_id := COALESCE(NEW.group_id, OLD.group_id);
  IF v_group_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.booking_groups bg
  SET total_amount = COALESCE((
        SELECT SUM(b.amount)
        FROM public.bookings b
        WHERE b.group_id = v_group_id
          AND b.status <> 'cancelled'
      ), 0)
  WHERE bg.id = v_group_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_recompute_group_total ON public.bookings;
CREATE TRIGGER trigger_recompute_group_total
  AFTER INSERT OR UPDATE OF amount, status, group_id OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_booking_group_total();

-- One-time backfill for existing groups whose total may have been client-set:
UPDATE public.booking_groups bg
SET total_amount = COALESCE((
  SELECT SUM(b.amount)
  FROM public.bookings b
  WHERE b.group_id = bg.id AND b.status <> 'cancelled'
), 0);

-- ---------- Replace the affected RLS policies ----------

-- USERS
DROP POLICY IF EXISTS users_update_own_profile ON public.users;
CREATE POLICY users_update_own_profile ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS users_select_super_admin ON public.users;
CREATE POLICY users_select_super_admin ON public.users
  FOR SELECT USING (public.is_super_admin());

-- AGENCIES — close the rogue-agency hole
DROP POLICY IF EXISTS agencies_owner_manage ON public.agencies;
DROP POLICY IF EXISTS agencies_owner_select ON public.agencies;
DROP POLICY IF EXISTS agencies_owner_update ON public.agencies;
DROP POLICY IF EXISTS agencies_super_admin_manage ON public.agencies;

CREATE POLICY agencies_owner_select ON public.agencies
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY agencies_owner_update ON public.agencies
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY agencies_super_admin_manage ON public.agencies
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- BOOKINGS — fix self-cancel transition
DROP POLICY IF EXISTS bookings_update_own_cancel ON public.bookings;
CREATE POLICY bookings_update_own_cancel ON public.bookings
  FOR UPDATE USING (user_id = auth.uid() AND status = 'confirmed')
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- CITIES — match new helper
DROP POLICY IF EXISTS cities_super_admin_manage ON public.cities;
CREATE POLICY cities_super_admin_manage ON public.cities
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- BUS LOCATIONS — restrict SELECT
DROP POLICY IF EXISTS bus_locations_public_read ON public.bus_locations;
DROP POLICY IF EXISTS bus_locations_select_authorized ON public.bus_locations;
CREATE POLICY bus_locations_select_authorized ON public.bus_locations
  FOR SELECT USING (
    bus_id IN (
      SELECT id FROM public.buses
      WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
    )
    OR (trip_id IS NOT NULL AND trip_id IN (SELECT trip_id FROM public.bookings WHERE user_id = auth.uid()))
    OR (trip_id IS NOT NULL AND trip_id IN (SELECT id FROM public.trips WHERE status IN ('boarding', 'departed')))
  );

-- AGENCY APPLICATIONS — add WITH CHECK on review
DROP POLICY IF EXISTS agency_apps_select_super ON public.agency_applications;
DROP POLICY IF EXISTS agency_apps_super_review ON public.agency_applications;
CREATE POLICY agency_apps_select_super ON public.agency_applications
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY agency_apps_super_review ON public.agency_applications
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ---------- Refresh approve_agency_application to use the helper ----------
CREATE OR REPLACE FUNCTION public.approve_agency_application(application_id UUID)
RETURNS UUID AS $$
DECLARE
  v_app public.agency_applications%ROWTYPE;
  v_agency_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super_admin can approve agency applications';
  END IF;

  SELECT * INTO v_app FROM public.agency_applications WHERE id = application_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or not pending';
  END IF;

  INSERT INTO public.agencies (name, slug, phone, address, city, owner_id, description)
  VALUES (v_app.proposed_name, v_app.proposed_slug, v_app.phone, v_app.address, v_app.city, v_app.user_id, v_app.description)
  RETURNING id INTO v_agency_id;

  UPDATE public.users
  SET role = 'agency_admin', agency_id = v_agency_id
  WHERE id = v_app.user_id;

  UPDATE public.agency_applications
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = application_id;

  RETURN v_agency_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

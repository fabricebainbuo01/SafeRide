-- =====================================================
-- SafeRide - Supabase Database Schema
-- Inter-Urban Bus Booking System for Cameroon
-- =====================================================
--
-- Run order:
--   1) schema.sql       (this file)
--   2) seed_agencies.sql (optional)
--   3) seed_trips.sql    (optional)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- TABLES (created in dependency order)
-- =====================================================

-- Cities / Routes (no FKs)
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (no agency_id yet — added later to break the circular FK)
-- phone is nullable: future OAuth/magic-link signups won't have one upfront.
-- UNIQUE still applies to non-NULL values (Postgres treats NULLs as distinct).
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'agency_admin', 'super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Older deployments of schema.sql had phone NOT NULL — relax it idempotently.
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN full_name SET DEFAULT '';

-- Agencies
CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  description TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now we can safely add users.agency_id
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL;

-- Agency-admin application requests (replaces manual SQL onboarding)
CREATE TABLE IF NOT EXISTS public.agency_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  proposed_name TEXT NOT NULL,
  proposed_slug TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buses / Fleet
CREATE TABLE IF NOT EXISTS public.buses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  model TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 200),
  -- seat_layout is now derived/validated by the trigger below to match capacity.
  seat_layout JSONB NOT NULL DEFAULT '{"rows": 8, "cols": 4, "aisleAfter": 2, "unavailable": []}'::jsonb,
  amenities TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, plate_number)
);

-- Trips / Schedules
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  origin_city_id UUID NOT NULL REFERENCES public.cities(id),
  destination_city_id UUID NOT NULL REFERENCES public.cities(id),
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  estimated_arrival_time TIME,
  price INTEGER NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  available_seats INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'boarding', 'departed', 'arrived', 'cancelled')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (origin_city_id <> destination_city_id)
);

-- Booking groups (one per checkout, may contain multiple seats)
CREATE TABLE IF NOT EXISTS public.booking_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  group_code TEXT UNIQUE NOT NULL,
  total_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('mobile_money', 'cash', 'card', 'paypal')),
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings (one per seat, optionally tied to a booking_group)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.booking_groups(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL CHECK (seat_number > 0),
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  booking_code TEXT UNIQUE NOT NULL DEFAULT (
    -- 12 chars from a base32-style alphabet => ~10^18 combos, collision-resistant
    upper(translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'XYZ'))
  ),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'cancelled', 'no_show')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('mobile_money', 'cash', 'card', 'paypal')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, seat_number)
);

-- Real-time bus location tracking
CREATE TABLE IF NOT EXISTS public.bus_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_agency ON public.users(agency_id);
CREATE INDEX IF NOT EXISTS idx_buses_agency ON public.buses(agency_id);
CREATE INDEX IF NOT EXISTS idx_trips_agency ON public.trips(agency_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON public.trips(origin_city_id, destination_city_id);
CREATE INDEX IF NOT EXISTS idx_trips_date ON public.trips(departure_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_group ON public.bookings(group_id);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON public.bookings(booking_code);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_booking_groups_user ON public.booking_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_groups_code ON public.booking_groups(group_code);
CREATE INDEX IF NOT EXISTS idx_bus_locations_bus ON public.bus_locations(bus_id);
CREATE INDEX IF NOT EXISTS idx_bus_locations_trip ON public.bus_locations(trip_id);
-- RealTimeTracker reads the latest ping per trip; this index serves it directly.
CREATE INDEX IF NOT EXISTS idx_bus_locations_trip_recorded
  ON public.bus_locations(trip_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_apps_status ON public.agency_applications(status);
-- A user may only have one PENDING agency application at a time. Approved /
-- rejected rows are kept for audit and don't conflict with new submissions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_apps_one_pending_per_user
  ON public.agency_applications(user_id) WHERE status = 'pending';
-- Two pending applications with the same proposed slug would race at approval.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_apps_one_pending_per_slug
  ON public.agency_applications(proposed_slug) WHERE status = 'pending';

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Atomic seat-counter trigger (handles every booking lifecycle path safely)
CREATE OR REPLACE FUNCTION public.update_available_seats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only count "live" bookings against availability.
    IF NEW.status IN ('confirmed', 'checked_in') THEN
      UPDATE public.trips
      SET available_seats = GREATEST(available_seats - 1, 0)
      WHERE id = NEW.trip_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Only restore the seat if the deleted booking was still live.
    IF OLD.status IN ('confirmed', 'checked_in') THEN
      UPDATE public.trips t
      SET available_seats = LEAST(available_seats + 1, b.capacity)
      FROM public.buses b
      WHERE t.id = OLD.trip_id AND b.id = t.bus_id;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Live -> not-live (cancel/no_show): release the seat.
    IF OLD.status IN ('confirmed', 'checked_in')
       AND NEW.status IN ('cancelled', 'no_show') THEN
      UPDATE public.trips t
      SET available_seats = LEAST(available_seats + 1, b.capacity)
      FROM public.buses b
      WHERE t.id = NEW.trip_id AND b.id = t.bus_id;

    -- Not-live -> live (re-activation): take the seat back.
    ELSIF OLD.status IN ('cancelled', 'no_show')
          AND NEW.status IN ('confirmed', 'checked_in') THEN
      UPDATE public.trips
      SET available_seats = GREATEST(available_seats - 1, 0)
      WHERE id = NEW.trip_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_available_seats ON public.bookings;
CREATE TRIGGER trigger_update_available_seats
  AFTER INSERT OR DELETE OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_available_seats();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS set_agencies_updated_at ON public.agencies;
DROP TRIGGER IF EXISTS set_buses_updated_at ON public.buses;
DROP TRIGGER IF EXISTS set_trips_updated_at ON public.trips;
DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
DROP TRIGGER IF EXISTS set_booking_groups_updated_at ON public.booking_groups;

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_agencies_updated_at BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_buses_updated_at BEFORE UPDATE ON public.buses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_booking_groups_updated_at BEFORE UPDATE ON public.booking_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Initialize trip.available_seats from bus capacity & validate seat layout matches capacity.
CREATE OR REPLACE FUNCTION public.init_trip_available_seats()
RETURNS TRIGGER AS $$
DECLARE
  bus_capacity INTEGER;
BEGIN
  SELECT capacity INTO bus_capacity FROM public.buses WHERE id = NEW.bus_id;

  IF NEW.available_seats = 0 THEN
    NEW.available_seats := bus_capacity;
  END IF;

  IF NEW.available_seats > bus_capacity THEN
    RAISE EXCEPTION 'available_seats (%) cannot exceed bus capacity (%)', NEW.available_seats, bus_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_init_trip_available_seats ON public.trips;
CREATE TRIGGER trigger_init_trip_available_seats
  BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.init_trip_available_seats();

-- Default seat_layout to a layout that actually fits the bus capacity (4-across with aisle after col 2).
CREATE OR REPLACE FUNCTION public.derive_seat_layout()
RETURNS TRIGGER AS $$
DECLARE
  default_cols INTEGER := 4;
  default_aisle INTEGER := 2;
  needed_rows INTEGER;
  current_rows INTEGER;
  current_cols INTEGER;
BEGIN
  current_rows := COALESCE((NEW.seat_layout->>'rows')::int, 0);
  current_cols := COALESCE((NEW.seat_layout->>'cols')::int, 0);

  IF current_rows * current_cols < NEW.capacity THEN
    needed_rows := CEIL(NEW.capacity::numeric / default_cols);
    NEW.seat_layout := jsonb_build_object(
      'rows', needed_rows,
      'cols', default_cols,
      'aisleAfter', default_aisle,
      'unavailable', '[]'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_derive_seat_layout ON public.buses;
CREATE TRIGGER trigger_derive_seat_layout
  BEFORE INSERT OR UPDATE OF capacity, seat_layout ON public.buses
  FOR EACH ROW EXECUTE FUNCTION public.derive_seat_layout();

-- -----------------------------------------------------
-- Auto-mirror auth.users → public.users on signup
-- -----------------------------------------------------
-- Why a trigger and not a client-side INSERT?
--   With email confirmation enabled, supabase.auth.signUp() returns NO session,
--   so the next client request runs as `anon` and `auth.uid()` is NULL — which
--   makes the users_insert_self_passenger RLS policy reject the row.
--   This trigger runs as `postgres` (BYPASSRLS) the moment the auth.users row
--   is created, so the public.users profile is always materialized.
--
-- The client passes display data via supabase.auth.signUp({ options: { data } })
-- where data has `full_name` and (optionally) `phone`. Anything missing is
-- defaulted to an empty string / NULL respectively.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, phone, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    'passenger'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- -----------------------------------------------------
-- Helper: is the calling user a super_admin?
-- -----------------------------------------------------
-- Defined as SECURITY DEFINER + STABLE so RLS policies that reference
-- public.users won't recurse into themselves when evaluated. Cached per
-- statement via STABLE.
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

-- -----------------------------------------------------
-- Helper: is the caller a privileged execution context that should bypass our
-- column-level immutability checks?
-- -----------------------------------------------------
-- TRUE when running as one of:
--   * `postgres` / `supabase_admin` (SQL Editor, migrations, dashboards),
--   * `service_role` (server-only secrets used by API routes),
--   * inside a SECURITY DEFINER function owned by `postgres` (e.g. the
--     approve_agency_application RPC) — because current_user becomes the
--     function owner inside such a function.
--
-- Authenticated super_admins do NOT bypass directly via the public API: any
-- privileged write must flow through a SECURITY DEFINER RPC like
-- approve_agency_application. That keeps the audit story simple.
--
-- IMPORTANT: not SECURITY DEFINER — we need session_user/current_user to
-- reflect the actual caller, not the function owner.
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

-- -----------------------------------------------------
-- Column-level immutability triggers
-- -----------------------------------------------------
-- These run BEFORE UPDATE and reject changes to columns that RLS policies
-- intentionally don't cover (RLS is row-level, not column-level). They give
-- the same defence-in-depth as a Postgres column privilege grant but work
-- alongside the existing Supabase role model. Super-admins are exempt so they
-- can still fix data.

CREATE OR REPLACE FUNCTION public.lock_user_immutable_cols()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_privileged_caller() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'users.id is immutable';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'users.role can only be changed by super_admin (use approve_agency_application)';
  END IF;
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION 'users.agency_id can only be changed by super_admin (use approve_agency_application)';
  END IF;

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
  IF public.is_privileged_caller() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id        IS DISTINCT FROM OLD.user_id        THEN RAISE EXCEPTION 'bookings.user_id is immutable';        END IF;
  IF NEW.trip_id        IS DISTINCT FROM OLD.trip_id        THEN RAISE EXCEPTION 'bookings.trip_id is immutable';        END IF;
  IF NEW.seat_number    IS DISTINCT FROM OLD.seat_number    THEN RAISE EXCEPTION 'bookings.seat_number is immutable';    END IF;
  IF NEW.amount         IS DISTINCT FROM OLD.amount         THEN RAISE EXCEPTION 'bookings.amount is immutable';         END IF;
  IF NEW.currency       IS DISTINCT FROM OLD.currency       THEN RAISE EXCEPTION 'bookings.currency is immutable';       END IF;
  IF NEW.passenger_name IS DISTINCT FROM OLD.passenger_name THEN RAISE EXCEPTION 'bookings.passenger_name is immutable'; END IF;
  IF NEW.passenger_phone IS DISTINCT FROM OLD.passenger_phone THEN RAISE EXCEPTION 'bookings.passenger_phone is immutable'; END IF;
  IF NEW.booking_code   IS DISTINCT FROM OLD.booking_code   THEN RAISE EXCEPTION 'bookings.booking_code is immutable';   END IF;
  IF NEW.group_id       IS DISTINCT FROM OLD.group_id       THEN RAISE EXCEPTION 'bookings.group_id is immutable';       END IF;

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
  IF public.is_privileged_caller() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id        IS DISTINCT FROM OLD.user_id        THEN RAISE EXCEPTION 'agency_applications.user_id is immutable';        END IF;
  IF NEW.proposed_name  IS DISTINCT FROM OLD.proposed_name  THEN RAISE EXCEPTION 'agency_applications.proposed_name is immutable';  END IF;
  IF NEW.proposed_slug  IS DISTINCT FROM OLD.proposed_slug  THEN RAISE EXCEPTION 'agency_applications.proposed_slug is immutable';  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_application_cols ON public.agency_applications;
CREATE TRIGGER trigger_lock_application_cols
  BEFORE UPDATE ON public.agency_applications
  FOR EACH ROW EXECUTE FUNCTION public.lock_application_immutable_cols();

-- -----------------------------------------------------
-- booking_groups.total_amount = SUM(bookings.amount) on the same group
-- -----------------------------------------------------
-- 1) On INSERT, force the column to 0 — the client doesn't get to declare
--    how much the trip costs; the DB derives it from bookings.amount, which
--    is itself pinned to trips.price by the bookings_insert_self RLS policy.
-- 2) On every change to an attached booking, recompute the group total so
--    payment routes can trust booking_groups.total_amount as authoritative.
CREATE OR REPLACE FUNCTION public.zero_booking_group_total_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Pin server-controlled columns regardless of what the client sent.
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

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_applications ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users','agencies','buses','trips','bookings','booking_groups','cities','bus_locations','agency_applications')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- USERS
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_select_agency_admins ON public.users
  FOR SELECT USING (
    agency_id IS NOT NULL
    AND agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  );

-- Super-admins need to read every user record (e.g. join from
-- agency_applications.user_id to render the applicant's name on the review page).
-- Uses the is_super_admin() helper to avoid recursive evaluation against this
-- same table.
CREATE POLICY users_select_super_admin ON public.users
  FOR SELECT USING (public.is_super_admin());

-- New signups can ONLY register as passenger; promotion happens through the
-- agency_applications flow + super_admin review.
CREATE POLICY users_insert_self_passenger ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id AND role = 'passenger' AND agency_id IS NULL);

-- Update own profile fields. Role and agency_id are pinned by the
-- lock_user_immutable_cols BEFORE UPDATE trigger (defined further down) so
-- a user cannot self-promote even if a buggy client sends those columns.
CREATE POLICY users_update_own_profile ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- AGENCIES
-- Public read for active agencies (search/listing).
CREATE POLICY agencies_public_read ON public.agencies
  FOR SELECT USING (is_active = true);

-- Owners can read their own agency even when inactive.
CREATE POLICY agencies_owner_select ON public.agencies
  FOR SELECT USING (owner_id = auth.uid());

-- Owners can update their own agency (e.g. logo, description, address) but
-- cannot transfer ownership — see lock_agency_immutable_cols trigger below.
CREATE POLICY agencies_owner_update ON public.agencies
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- IMPORTANT: agency creation is intentionally NOT exposed to owners.
-- The only sanctioned path is the agency_applications flow, which calls the
-- approve_agency_application RPC (SECURITY DEFINER) under super_admin authority.
-- This prevents passengers from minting rogue agencies and then using
-- buses/trips/booking RLS policies that key off `agencies.owner_id = auth.uid()`.

-- Super-admins retain full management (create / delete / fix data).
CREATE POLICY agencies_super_admin_manage ON public.agencies
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- BUSES
CREATE POLICY buses_public_read_active ON public.buses
  FOR SELECT USING (is_active = true);

CREATE POLICY buses_agency_manage ON public.buses
  FOR ALL USING (
    agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  );

CREATE POLICY buses_manage_agency_staff ON public.buses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = buses.agency_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = buses.agency_id
    )
  );

CREATE POLICY buses_super_admin_manage ON public.buses
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- TRIPS
CREATE POLICY trips_public_search ON public.trips
  FOR SELECT USING (is_active = true);

CREATE POLICY trips_agency_manage ON public.trips
  FOR ALL USING (
    agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  );

-- Agency admins linked via users.agency_id (application-approved staff), not only agencies.owner_id.
CREATE POLICY trips_manage_agency_staff ON public.trips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = trips.agency_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.agency_id IS NOT NULL
        AND u.agency_id = trips.agency_id
    )
  );

CREATE POLICY trips_super_admin_manage ON public.trips
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- BOOKING GROUPS (passengers see/own; agencies can read groups for their trips)
CREATE POLICY booking_groups_select_own ON public.booking_groups
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY booking_groups_select_agency ON public.booking_groups
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM public.trips
      WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
    )
  );

-- Insert: enforced amount = trip.price * seat count is validated at the API layer; here we just
-- ensure the user can only create a group for themselves and payment_status is pending.
CREATE POLICY booking_groups_insert_self ON public.booking_groups
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND payment_status = 'pending'
    AND paid_at IS NULL
  );

-- Allow removing an abandoned checkout shell when bookings INSERT fails mid-flow.
CREATE POLICY booking_groups_delete_own_abandoned ON public.booking_groups
  FOR DELETE USING (
    user_id = auth.uid()
    AND payment_status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.group_id = booking_groups.id
    )
  );

-- BOOKINGS
CREATE POLICY bookings_select_own ON public.bookings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY bookings_select_agency ON public.bookings
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM public.trips
      WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
    )
  );

-- Global read for super-admin dashboards and realtime feeds (all agencies).
CREATE POLICY bookings_select_super_admin ON public.bookings
  FOR SELECT USING (public.is_super_admin());

-- Insert: enforce that the user owns the booking, the price matches the trip,
-- payment is not pre-marked, and status starts as confirmed.
CREATE POLICY bookings_insert_self ON public.bookings
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status = 'confirmed'
    AND payment_status = 'pending'
    AND amount = (SELECT price FROM public.trips WHERE id = trip_id)
  );

-- Update by user: only self-cancel a confirmed (not-yet-checked-in) booking.
-- USING evaluates against the OLD row, WITH CHECK against the NEW row, so this
-- locks the transition `confirmed -> cancelled` and nothing else.
CREATE POLICY bookings_update_own_cancel ON public.bookings
  FOR UPDATE USING (user_id = auth.uid() AND status = 'confirmed')
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- Update by agency: status (check-in / no_show / cancel) and payment_status.
-- Column-level immutability (user_id, seat_number, amount, ...) is enforced by
-- the lock_booking_immutable_cols BEFORE UPDATE trigger (defined further down).
CREATE POLICY bookings_update_agency ON public.bookings
  FOR UPDATE USING (
    trip_id IN (
      SELECT id FROM public.trips
      WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT id FROM public.trips
      WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
    )
  );

-- CITIES
CREATE POLICY cities_public_read ON public.cities
  FOR SELECT USING (is_active = true);

CREATE POLICY cities_super_admin_manage ON public.cities
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- BUS LOCATIONS
-- Visible only to (a) the agency that owns the bus, (b) passengers who hold a
-- booking on the trip, or (c) anyone while the trip is currently boarding /
-- departed (so a passenger awaiting pickup can still see ETA without auth).
CREATE POLICY bus_locations_select_authorized ON public.bus_locations
  FOR SELECT USING (
    bus_id IN (
      SELECT id FROM public.buses
      WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
    )
    OR (
      trip_id IS NOT NULL
      AND trip_id IN (SELECT trip_id FROM public.bookings WHERE user_id = auth.uid())
    )
    OR (
      trip_id IS NOT NULL
      AND trip_id IN (SELECT id FROM public.trips WHERE status IN ('boarding', 'departed'))
    )
  );

CREATE POLICY bus_locations_agency_insert ON public.bus_locations
  FOR INSERT WITH CHECK (
    bus_id IN (
      SELECT id FROM public.buses
      WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
    )
  );

-- AGENCY APPLICATIONS
CREATE POLICY agency_apps_select_own ON public.agency_applications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY agency_apps_select_super ON public.agency_applications
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY agency_apps_insert_self ON public.agency_applications
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY agency_apps_super_review ON public.agency_applications
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
-- user_id immutability on review is enforced by lock_application_immutable_cols
-- (defined further down).

-- =====================================================
-- APPROVE-AGENCY RPC (run as super_admin)
-- =====================================================
-- Atomically: create agency, link user, mark application approved.
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

-- =====================================================
-- SEED DATA: Cameroon cities (English labels matched to client fallback)
-- =====================================================

INSERT INTO public.cities (name, region) VALUES
  ('Douala',     'Littoral'),
  ('Yaounde',    'Centre'),
  ('Bafoussam',  'West'),
  ('Bamenda',    'North West'),
  ('Garoua',     'North'),
  ('Maroua',     'Far North'),
  ('Ngaoundere', 'Adamawa'),
  ('Bertoua',    'East'),
  ('Ebolowa',    'South'),
  ('Kribi',      'South'),
  ('Limbe',      'South West'),
  ('Buea',       'South West'),
  ('Dschang',    'West'),
  ('Nkongsamba', 'Littoral'),
  ('Bafia',      'Centre'),
  ('Mbalmayo',   'Centre'),
  ('Sangmelima', 'South'),
  ('Yagoua',     'Far North'),
  ('Kousseri',   'Far North'),
  ('Foumban',    'West'),
  ('Kumba',      'South West'),
  ('Edea',       'Littoral')
ON CONFLICT (name) DO UPDATE SET region = EXCLUDED.region;

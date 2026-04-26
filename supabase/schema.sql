-- =====================================================
-- SafeRide - Supabase Database Schema
-- Inter-Urban Bus Booking System for Cameroon
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (extends Supabase Auth users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'agency_admin', 'super_admin')),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agencies table
CREATE TABLE public.agencies (
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

-- Update users table to reference agencies after creation
-- (agency_id column already added above with SET NULL)

-- Cities / Routes table
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buses / Fleet table
CREATE TABLE public.buses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  model TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  seat_layout JSONB NOT NULL DEFAULT '{
    "rows": 4,
    "cols": 4,
    "aisleAfter": 2,
    "unavailable": []
  }'::jsonb,
  amenities TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, plate_number)
);

-- Trips / Schedules table
CREATE TABLE public.trips (
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL,
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  booking_code TEXT UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 8)),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'cancelled', 'no_show')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('mobile_money', 'cash', 'card')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, seat_number)
);

-- Real-time bus location tracking
CREATE TABLE public.bus_locations (
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

CREATE INDEX idx_users_agency ON public.users(agency_id);
CREATE INDEX idx_buses_agency ON public.buses(agency_id);
CREATE INDEX idx_trips_agency ON public.trips(agency_id);
CREATE INDEX idx_trips_route ON public.trips(origin_city_id, destination_city_id);
CREATE INDEX idx_trips_date ON public.trips(departure_date);
CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_bookings_trip ON public.bookings(trip_id);
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_code ON public.bookings(booking_code);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bus_locations_bus ON public.bus_locations(bus_id);
CREATE INDEX idx_bus_locations_trip ON public.bus_locations(trip_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update available_seats on booking changes
CREATE OR REPLACE FUNCTION public.update_available_seats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.trips
    SET available_seats = available_seats - 1
    WHERE id = NEW.trip_id AND available_seats > 0;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.trips
    SET available_seats = available_seats + 1
    WHERE id = OLD.trip_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.trips
    SET available_seats = available_seats + 1
    WHERE id = NEW.trip_id;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for seat availability
CREATE TRIGGER trigger_update_available_seats
  AFTER INSERT OR DELETE OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_available_seats();

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_agencies_updated_at BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_buses_updated_at BEFORE UPDATE ON public.buses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function to initialize available_seats when a trip is created
CREATE OR REPLACE FUNCTION public.init_trip_available_seats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.available_seats = 0 THEN
    SELECT capacity INTO NEW.available_seats
    FROM public.buses
    WHERE id = NEW.bus_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_init_trip_available_seats
  BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.init_trip_available_seats();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;

-- Users: read own profile, update own profile
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Agency admins can read their agency users" ON public.users
  FOR SELECT USING (agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()));

-- Agencies: public read, owner write
CREATE POLICY "Agencies are publicly readable" ON public.agencies
  FOR SELECT USING (is_active = true);
CREATE POLICY "Agency owner can update" ON public.agencies
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Agency owner can insert" ON public.agencies
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Buses: agency admins can manage, public can read active
CREATE POLICY "Active buses are publicly readable" ON public.buses
  FOR SELECT USING (is_active = true);
CREATE POLICY "Agency admins can manage buses" ON public.buses
  FOR ALL USING (agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()));

-- Trips: public can search, agency admins manage
CREATE POLICY "Active trips are publicly searchable" ON public.trips
  FOR SELECT USING (is_active = true);
CREATE POLICY "Agency admins can manage trips" ON public.trips
  FOR ALL USING (agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()));

-- Bookings: users manage own, agency admins can read/update
CREATE POLICY "Users can read own bookings" ON public.bookings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can cancel own bookings" ON public.bookings
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Agency admins can manage trip bookings" ON public.bookings
  FOR SELECT USING (trip_id IN (SELECT id FROM public.trips WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())));
CREATE POLICY "Agency admins can check in bookings" ON public.bookings
  FOR UPDATE USING (trip_id IN (SELECT id FROM public.trips WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())));

-- Cities: public read
CREATE POLICY "Cities are publicly readable" ON public.cities
  FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage cities" ON public.cities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Bus locations: public read, agency write
CREATE POLICY "Bus locations are publicly readable" ON public.bus_locations
  FOR SELECT USING (true);
CREATE POLICY "Agency admins can insert locations" ON public.bus_locations
  FOR INSERT WITH CHECK (
    bus_id IN (SELECT id FROM public.buses WHERE agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()))
  );

-- =====================================================
-- SEED DATA (Cameroon cities)
-- =====================================================

INSERT INTO public.cities (name, region) VALUES
  ('Douala', 'Littoral'),
  ('Yaounde', 'Centre'),
  ('Bafoussam', 'Ouest'),
  ('Bamenda', 'Nord-Ouest'),
  ('Garoua', 'Nord'),
  ('Maroua', 'Extreme-Nord'),
  ('Ngaoundere', 'Adamaoua'),
  ('Bertoua', 'Est'),
  ('Ebolowa', 'Sud'),
  ('Kribi', 'Sud'),
  ('Limbe', 'Sud-Ouest'),
  ('Buea', 'Sud-Ouest'),
  ('Dschang', 'Ouest'),
  ('Nkongsamba', 'Littoral'),
  ('Bafia', 'Centre'),
  ('Mbalmayo', 'Centre'),
  ('Sangmelima', 'Sud'),
  ('Yagoua', 'Extreme-Nord'),
  ('Kousseri', 'Extreme-Nord'),
  ('Foumban', 'Ouest');

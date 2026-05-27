-- =====================================================
-- SafeRide - Seed script for dummy Trips and Buses
-- Run this in your Supabase SQL Editor to generate test data!
--
-- Seeds buses + trips for EVERY active agency so /admin/schedules works for any
-- agency admin (trips are filtered by users.agency_id). Re-running inserts
-- duplicate trips unless you truncate trips/buses first — intended for dev only.
-- =====================================================

DO $$
DECLARE
  agency_rec RECORD;
  v_bus_1_id UUID;
  v_bus_2_id UUID;
  v_bus_3_id UUID;
  v_douala_id UUID;
  v_yaounde_id UUID;
  v_bamenda_id UUID;
  v_bafoussam_id UUID;
  v_kribi_id UUID;
  v_date DATE;
  i INT;
  v_agency_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_agency_count FROM public.agencies WHERE is_active = true;
  IF v_agency_count = 0 THEN
    RAISE NOTICE 'No active agencies. Run seed_agencies.sql or create an agency first.';
    RETURN;
  END IF;

  SELECT id INTO v_douala_id FROM public.cities WHERE name = 'Douala' LIMIT 1;
  SELECT id INTO v_yaounde_id FROM public.cities WHERE name = 'Yaounde' LIMIT 1;
  SELECT id INTO v_bamenda_id FROM public.cities WHERE name = 'Bamenda' LIMIT 1;
  SELECT id INTO v_bafoussam_id FROM public.cities WHERE name = 'Bafoussam' LIMIT 1;
  SELECT id INTO v_kribi_id FROM public.cities WHERE name = 'Kribi' LIMIT 1;

  IF v_douala_id IS NULL OR v_yaounde_id IS NULL THEN
    RAISE NOTICE 'Douala and/or Yaounde cities missing — cannot seed routes. Ensure cities from schema.sql exist.';
    RETURN;
  END IF;

  IF v_bamenda_id IS NULL OR v_bafoussam_id IS NULL OR v_kribi_id IS NULL THEN
    RAISE NOTICE 'Optional cities missing (Bamenda/Bafoussam/Kribi); skipping routes that need them.';
  END IF;

  FOR agency_rec IN
    SELECT id, slug, name FROM public.agencies WHERE is_active = true ORDER BY name
  LOOP
    INSERT INTO public.buses (agency_id, plate_number, model, capacity, is_active)
    VALUES
      (agency_rec.id, 'LT-123-AB', 'VIP 80 seater Bus', 30, true),
      (agency_rec.id, 'CE-456-XY', '70 seater Bus', 70, true),
      (agency_rec.id, 'NW-789-QW', 'Hyundai County', 25, true)
    ON CONFLICT (agency_id, plate_number) DO NOTHING;

    SELECT id INTO v_bus_1_id FROM public.buses WHERE agency_id = agency_rec.id AND plate_number = 'LT-123-AB' LIMIT 1;
    SELECT id INTO v_bus_2_id FROM public.buses WHERE agency_id = agency_rec.id AND plate_number = 'CE-456-XY' LIMIT 1;
    SELECT id INTO v_bus_3_id FROM public.buses WHERE agency_id = agency_rec.id AND plate_number = 'NW-789-QW' LIMIT 1;

    IF v_bus_1_id IS NULL OR v_bus_2_id IS NULL OR v_bus_3_id IS NULL THEN
      RAISE NOTICE 'Skipping agency % — buses missing after insert.', agency_rec.slug;
      CONTINUE;
    END IF;

    v_date := CURRENT_DATE;
    FOR i IN 0..14 LOOP
      INSERT INTO public.trips (agency_id, bus_id, origin_city_id, destination_city_id, departure_date, departure_time, estimated_arrival_time, price, status)
      VALUES (agency_rec.id, v_bus_1_id, v_douala_id, v_yaounde_id, v_date + i, '07:00:00', '11:30:00', 5000, 'scheduled');

      INSERT INTO public.trips (agency_id, bus_id, origin_city_id, destination_city_id, departure_date, departure_time, estimated_arrival_time, price, status)
      VALUES (agency_rec.id, v_bus_1_id, v_yaounde_id, v_douala_id, v_date + i, '14:00:00', '18:30:00', 5000, 'scheduled');

      IF v_bamenda_id IS NOT NULL THEN
        INSERT INTO public.trips (agency_id, bus_id, origin_city_id, destination_city_id, departure_date, departure_time, estimated_arrival_time, price, status)
        VALUES (agency_rec.id, v_bus_2_id, v_douala_id, v_bamenda_id, v_date + i, '20:00:00', '06:00:00', 8000, 'scheduled');

        INSERT INTO public.trips (agency_id, bus_id, origin_city_id, destination_city_id, departure_date, departure_time, estimated_arrival_time, price, status)
        VALUES (agency_rec.id, v_bus_2_id, v_bamenda_id, v_douala_id, v_date + i, '06:00:00', '15:00:00', 8000, 'scheduled');
      END IF;

      IF v_bafoussam_id IS NOT NULL THEN
        INSERT INTO public.trips (agency_id, bus_id, origin_city_id, destination_city_id, departure_date, departure_time, estimated_arrival_time, price, status)
        VALUES (agency_rec.id, v_bus_3_id, v_yaounde_id, v_bafoussam_id, v_date + i, '09:00:00', '13:30:00', 4500, 'scheduled');
      END IF;

      IF v_kribi_id IS NOT NULL THEN
        INSERT INTO public.trips (agency_id, bus_id, origin_city_id, destination_city_id, departure_date, departure_time, estimated_arrival_time, price, status)
        VALUES (agency_rec.id, v_bus_3_id, v_douala_id, v_kribi_id, v_date + i, '08:30:00', '11:00:00', 3500, 'scheduled');
      END IF;
    END LOOP;

    RAISE NOTICE 'Seeded trips for agency slug=% id=%', agency_rec.slug, agency_rec.id;
  END LOOP;

  RAISE NOTICE 'Done. Total active agencies seeded: %', v_agency_count;
END $$;

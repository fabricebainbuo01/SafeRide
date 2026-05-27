-- =====================================================
-- SEED DATA: Travel Agencies in Cameroon
-- =====================================================
-- Prerequisites:
--   1. Run schema.sql first (tables + RLS).
--   2. Have at least one row in public.users (register via the app or insert).
--
-- Owner assignment:
--   Agencies reference owner_id → public.users(id). If that user row is later
--   deleted (account deletion), CASCADE removes those agencies — re-run this seed.
--
-- Verify after running (SQL Editor):
--   SELECT COUNT(*) FROM public.agencies WHERE is_active = true;
-- On the anon API key, agencies must satisfy RLS (active rows are publicly readable).

DO $$
DECLARE
    default_owner_id UUID;
    v_before INT;
    v_after INT;
BEGIN
    SELECT COUNT(*)::INT INTO v_before FROM public.agencies;

    -- Find the first user in the system to assign as the owner
    SELECT id INTO default_owner_id FROM public.users LIMIT 1;

    IF default_owner_id IS NULL THEN
        RAISE EXCEPTION 'No user found in public.users. Please sign up or create at least one user before running this seed script.';
    END IF;

    -- Insert popular travel agencies in Cameroon
    INSERT INTO public.agencies (name, slug, description, phone, email, address, city, owner_id, is_active)
    VALUES
        ('Amour Mezam Express', 'amour-mezam', 'Leading transport agency linking the North West to other regions.', '+237 600000001', 'contact@amourmezam.cm', 'Ntarikon', 'Bamenda', default_owner_id, true),
        ('Musango Bus Service', 'musango', 'Comfortable and reliable transport across Cameroon.', '+237 600000002', 'info@musango.cm', 'Akwa', 'Douala', default_owner_id, true),
        ('Moghamo Express', 'moghamo', 'Safe and affordable travel.', '+237 600000003', 'support@moghamo.cm', 'Ntarikon', 'Bamenda', default_owner_id, true),
        ('Vatican Express', 'vatican', 'Premium VIP transport services.', '+237 600000004', 'contact@vaticanexpress.cm', 'Mvan', 'Yaounde', default_owner_id, true),
        ('Oasis Travel', 'oasis', 'Modern fleet for your comfort.', '+237 600000005', 'hello@oasistravel.cm', 'Akwa', 'Douala', default_owner_id, true),
        ('Buca Voyages', 'buca', 'Experience luxury travel.', '+237 600000006', 'info@bucavoyages.cm', 'Mvan', 'Yaounde', default_owner_id, true),
        ('Garantie Express', 'garantie', 'Guaranteed safety and comfort.', '+237 600000007', 'contact@garantie.cm', 'Bépanda', 'Douala', default_owner_id, true),
        ('General Express Voyages', 'general-express', 'Your preferred travel partner.', '+237 600000008', 'support@generalexpress.cm', 'Mvan', 'Yaounde', default_owner_id, true),
        ('Touristique Express', 'touristique', 'Connecting the North and the South.', '+237 600000009', 'info@touristique.cm', 'Mvan', 'Yaounde', default_owner_id, true),
        ('Finexs Voyages', 'finexs', 'First Class Travel Experience.', '+237 600000010', 'contact@finexs.cm', 'Akwa', 'Douala', default_owner_id, true),
        ('Danay Express', 'danay', 'Reliable transport to the Grand North.', '+237 600000011', 'info@danayexpress.cm', 'Domayo', 'Maroua', default_owner_id, true),
        ('United Express', 'united', 'Unity in travel.', '+237 600000012', 'contact@unitedexpress.cm', 'Akwa', 'Douala', default_owner_id, true),
        ('Menoua Voyage', 'menoua', 'Direct lines to the West Region.', '+237 600000013', 'info@menouavoyage.cm', 'Gare Routière', 'Dschang', default_owner_id, true),
        ('Tresor Voyage', 'tresor', 'Treasured moments on the road.', '+237 600000014', 'contact@tresorvoyage.cm', 'Deido', 'Douala', default_owner_id, true)
    ON CONFLICT (slug) DO UPDATE
    SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        city = EXCLUDED.city,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        owner_id = EXCLUDED.owner_id,
        is_active = EXCLUDED.is_active;

    SELECT COUNT(*)::INT INTO v_after FROM public.agencies;
    RAISE NOTICE 'Seed agencies: rows before %, after % (owner user_id=%)', v_before, v_after, default_owner_id;
END $$;

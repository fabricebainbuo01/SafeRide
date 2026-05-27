-- =====================================================
-- 2026-04-28  Auto-mirror auth.users → public.users
-- =====================================================
-- Apply this on top of an existing deployment to make signup work cleanly
-- with email confirmation enabled.
--
-- Why this is needed:
--   When email confirmation is on, supabase.auth.signUp() returns NO session,
--   so the client cannot insert into public.users — the users_insert_self_passenger
--   RLS policy needs auth.uid() = id, but auth.uid() is NULL with no session.
--   The fix is to materialize public.users automatically the moment auth.users
--   gets a row, via a SECURITY DEFINER trigger that bypasses RLS.
--
-- Safe to re-run.
-- =====================================================

-- 1) Relax the phone constraint so OAuth / magic-link signups (which don't
--    collect a phone upfront) can succeed. UNIQUE still applies to non-NULLs.
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN full_name SET DEFAULT '';

-- 2) The mirror function — SECURITY DEFINER so it bypasses the RLS policy on
--    public.users (the postgres role has BYPASSRLS in Supabase).
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

-- 3) Wire it onto auth.users (Supabase's auth schema).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

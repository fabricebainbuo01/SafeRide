-- Super-admin global SELECT on bookings (dashboards + postgres_changes subscriptions).

DROP POLICY IF EXISTS bookings_select_super_admin ON public.bookings;

CREATE POLICY bookings_select_super_admin ON public.bookings
  FOR SELECT USING (public.is_super_admin());

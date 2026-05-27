-- Agency admins approved via applications have users.agency_id set but are often not
-- agencies.owner_id. Existing policies only allowed owners — INSERT on trips failed silently
-- from RLS for staff admins.

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

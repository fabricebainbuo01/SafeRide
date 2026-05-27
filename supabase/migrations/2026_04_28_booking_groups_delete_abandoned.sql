-- Allow passengers to DELETE booking_groups rows they created when zero bookings
-- exist yet (rollback after failed bulk INSERT — see book/[tripId]/page.tsx).

DROP POLICY IF EXISTS booking_groups_delete_own_abandoned ON public.booking_groups;

CREATE POLICY booking_groups_delete_own_abandoned ON public.booking_groups
  FOR DELETE USING (
    user_id = auth.uid()
    AND payment_status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.group_id = booking_groups.id
    )
  );

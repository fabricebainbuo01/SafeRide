# SafeRide

Inter-urban bus booking for Cameroon — search trips, pick seats on a live grid,
pay with Mobile Money / PayPal, ride safely. Built with Next.js (App Router),
Tailwind v4, and Supabase (Postgres, Auth, Realtime, RLS).

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env (copy and fill in your Supabase project values)
cp .env.example .env.local

# 3. Apply the database schema
#    Open Supabase → SQL Editor → paste the contents of supabase/schema.sql
#    Then run incremental migrations under supabase/migrations/ (see table below).
#    (Optional: run supabase/seed_agencies.sql and supabase/seed_trips.sql for demo data)

# 4. Run the dev server
npm run dev

# Optional: verify docs/env/file alignment
npm run audit
```

The app will be available at <http://localhost:3000>.

> Detailed setup, RLS notes, and onboarding flows live in
> [`HOW_TO_CONNECT.md`](./HOW_TO_CONNECT.md).

## Incremental migrations (`supabase/migrations/`)

Apply **after** `schema.sql` on existing projects (order roughly chronological):

| File | Purpose |
|------|---------|
| `2026_04_28_auth_user_trigger.sql` | Mirror `auth.users` → `public.users` on signup |
| `2026_04_28_security_hardening.sql` | Policies, triggers, helpers |
| `2026_04_28_booking_groups_delete_abandoned.sql` | Delete abandoned checkout groups |
| `2026_04_28_bookings_super_admin_select.sql` | Super-admin read access on bookings |
| `2026_04_29_agency_staff_trips_buses_rls.sql` | Agency staff (non-owner) manage buses/trips |
| `2026_04_29_agency_routes_verification.sql` | **`agency_routes`** table + moderation RLS |

Fresh installs: run `schema.sql`, then each migration once (or merge equivalent objects into a single bootstrap SQL).

## Environment variables

`.env.local` (validated at boot via `src/lib/env.ts`):

| Variable                          | Where    | Required | Notes                                         |
| --------------------------------- | -------- | -------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | client   | yes      | Project URL from Supabase → Settings → API    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | client   | yes      | Anon public key                               |
| `SUPABASE_SERVICE_ROLE_KEY`       | server   | yes\*    | Used by `/api/payments/mock-confirm` and other server routes. **Never expose to the client.** |

\* Public pages still load without it; only server-side privileged operations
break.

## Tech stack

- **Next.js 16** (App Router, Server Components where it makes sense, client
  islands for interactivity)
- **Tailwind CSS v4** with semantic CSS variables (`--color-navy-*`,
  `--color-primary-*`, `--color-action-*`)
- **Supabase** — Postgres + Auth + Realtime + RLS, plus a service-role client
  for privileged server actions
- **Zustand** — single-screen booking flow state
- **Sonner** — toast notifications
- **Zod** — validates `process.env` at boot
- **Lucide React** — icons

## Project structure

```
src/
  app/
    page.tsx                         Landing + search form
    routes/page.tsx                  Explore routes (verified agency_routes + defaults)
    search/page.tsx                  Search results
    book/[tripId]/page.tsx           Seat selection + booking
    booking/[code]/page.tsx          Booking-group summary (mock pay)
    ticket/[code]/page.tsx           Ticket view / print
    book-tickets/page.tsx            Booking helper
    dashboard/page.tsx               Passenger dashboard
    dashboard/profile/page.tsx       Edit profile
    dashboard/agency-application/    Apply to be an agency admin
    admin/
      page.tsx                       Agency overview
      agency/page.tsx                Command center (metrics)
      routes/page.tsx                Agency corridors → moderator review
      fleet/page.tsx                 Bus management
      schedules/page.tsx             Trip scheduling
      bookings/page.tsx              Booking management + check-in
      revenue/page.tsx               Revenue analytics
      applications/page.tsx        Super-admin: agency applications
      super/page.tsx                 Super dashboard
      super/routes/page.tsx          Super-admin: verify routes
    auth/
      login/                         Sign in
      register/                      Register
      forgot-password/               Request reset email
      reset-password/                Set new password
      callback/                      Email-confirmation / OAuth callback
    apply-agency/, agency-application/
    api/
      payments/mock-confirm/         Mock Mobile-Money / PayPal confirmation
    faq/, terms/, news/, about/      Static pages
  components/
    layout/                          Navbar, Footer, AdminSidebar
    ui/                              Button, Input, Select, Card, Badge,
                                     SeatGrid, TripCard, TicketCard, Loading,
                                     Toaster
    booking/RealTimeTracker.tsx      Status-based progress widget
  lib/
    env.ts                           Zod-validated env
    supabase.ts                      Null-safe browser client
    supabase-server.ts               Server / service-role client
    rbac.ts                          Role helpers for admin UI
    toast.ts                         toast / toastError helpers
    utils.ts                         Formatters + cn()
  store/booking-store.ts             Booking-flow state
  types/index.ts                     Domain types
  middleware.ts                      Auth gating for /admin and /dashboard
supabase/
  schema.sql                         Tables, indexes, triggers, RLS, seeds
  migrations/                        Incremental SQL (see table above)
  seed_agencies.sql                  Optional demo agencies
  seed_trips.sql                     Optional demo trips
```

## Production checklist

Everything needed for a full booking marketplace is implemented **except**
replacing the placeholder payment path with a real provider:

| Remaining | Notes |
|-----------|--------|
| **PSP integration** | Swap `/api/payments/mock-confirm` for MTN MoMo / Orange Money / PayPal webhooks (signature verification → same DB updates). Marketing copy and FAQs describe WhatsApp confirmation today + roadmap payments. |

## Key flows

| Flow         | Description                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------- |
| Search       | Origin → destination → date → trip list                                                      |
| Booking      | Pick seats on grid → optional per-seat passenger info → one `booking_group` + N `bookings`   |
| Payment      | **`mock-confirm`** marks groups paid for testing; **production = PSP webhooks** (see above)   |
| Ticket       | Each booking gets a unique `booking_code`; print-friendly view at `/ticket/[code]`           |
| Check-in    | Agency admin searches by code → marks `status='checked_in'`                                  |
| Realtime    | Seat grid updates live via Postgres Changes on the `bookings` table                          |
| Admin apply  | Passenger submits `agency_applications` → super approves via RPC → `/admin` fleet/schedules |
| Routes       | Agency lists corridors at `/admin/routes`; super verifies at `/admin/super/routes`; public explorer at `/routes` |

## Security notes

- All client writes are gated by RLS. Notable hardenings vs. an out-of-the-box
  template:
  - `users` self-insert is restricted to `role='passenger'` and
    `agency_id IS NULL` (no self-promotion to `agency_admin`).
  - `users.role` and `users.agency_id` are pinned by the
    `lock_user_immutable_cols` BEFORE-UPDATE trigger — only privileged execution
    contexts (`postgres`, `service_role`, or our SECURITY DEFINER RPC) can
    change them.
  - `bookings` self-insert is restricted to `payment_status='pending'` and
    `amount = trip.price` (no self-paid bookings).
  - `bookings` self-update is restricted to the `confirmed → cancelled`
    transition only — `USING (status='confirmed') WITH CHECK (status='cancelled')`.
  - `bookings` immutable columns (`user_id`, `trip_id`, `seat_number`, `amount`,
    `currency`, `passenger_name/phone`, `booking_code`, `group_id`) are pinned
    by `lock_booking_immutable_cols` so even an agency admin cannot rewrite a
    sold seat.
  - `agencies` INSERT is **not** exposed to owners — the only sanctioned creation
    path is `approve_agency_application` (super_admin only). This closes the
    rogue-agency hole where any passenger could mint themselves an agency.
  - `booking_groups.total_amount` is server-derived: a BEFORE-INSERT trigger
    forces it to `0` and a per-booking AFTER trigger recomputes it from
    `SUM(bookings.amount)`. Payment routes can therefore trust the stored value.
  - `bus_locations` reads are limited to the agency that owns the bus, the
    passengers booked on the trip, or anyone while the trip is `boarding` /
    `departed`.
- A single-purpose migration at
  `supabase/migrations/2026_04_28_security_hardening.sql` upgrades older
  deployments without touching data.
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`) live behind
  `lib/supabase-server.ts` and are never imported into client components.

## Replacing the mock payment

`/api/payments/mock-confirm` is intentionally simple: it authenticates the
user via `Authorization: Bearer <access_token>` from the browser session (with
cookie-based auth as a fallback), verifies they own the booking group, then
uses the service-role client to mark the group + its bookings as `paid`. To go live:

1. Swap the body of the route handler for an MTN MoMo / Orange Money / PayPal
   webhook handler that verifies the provider's signature.
2. On confirmed payment, do the same DB update (atomically — both the
   `booking_groups` row and its `bookings` rows).
3. Optionally enqueue an SMS receipt via your SMS provider.

## Scripts

```bash
npm run dev      # Next.js dev server
npm run build    # Production build
npm run start    # Production server (after build)
npm run lint     # ESLint
npm run audit    # Repo checks (env keys, docs links, migrations list)
```

## License

Internal project — not yet open-sourced.

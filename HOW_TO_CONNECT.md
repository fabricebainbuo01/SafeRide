# SafeRide - How to Connect Guide

## Prerequisites

- Node.js 18+ installed
- A [Supabase](https://supabase.com) account (free tier works)
- Git (optional)

---

## Step 1: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for the project to finish provisioning (usually 1-2 minutes).
3. Go to **Project Settings > API** and copy:
   - **Project URL** (looks like `https://abcdefghijk.supabase.co`)
   - **Anon/Public Key** (a long JWT string)

## Step 2: Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**.
2. Open the file `supabase/schema.sql` from this project.
3. Copy its entire contents and paste it into the SQL Editor.
4. Click **Run** to execute. This creates core tables (`users`, `agencies`,
   `agency_applications`, `cities`, `buses`, `trips`, `bookings`,
   `booking_groups`, `bus_locations`), indexes, triggers, RPCs, RLS, and seed
   cities — details are in `schema.sql`.

### Incremental migrations (recommended order)

After `schema.sql`, run each SQL file once under `supabase/migrations/`:

| File | Purpose |
|------|---------|
| `2026_04_28_auth_user_trigger.sql` | Mirror auth users → `public.users` |
| `2026_04_28_security_hardening.sql` | Security helpers & policies |
| `2026_04_28_booking_groups_delete_abandoned.sql` | Abandoned checkout cleanup |
| `2026_04_28_bookings_super_admin_select.sql` | Super-admin booking reads |
| `2026_04_29_agency_staff_trips_buses_rls.sql` | Non-owner agency staff manage trips/buses |
| `2026_04_29_agency_routes_verification.sql` | **`agency_routes`** + moderation RLS |
| `2026_05_06_bi_leads_and_featured.sql` | **BI**: `leads_tracking`, `page_views`, `agencies.subscription_status`, `agency_routes.is_featured` |

### Already deployed an older version?

If your project pre-dates the security hardening (April 2026), apply the
focused migration in `supabase/migrations/2026_04_28_security_hardening.sql`
instead of re-running the whole schema. It only adds policies, triggers, and
helper functions — no data is touched.

If you already ran that migration but deployed **before** the abandoned-checkout
rollback policy was added, also run
`supabase/migrations/2026_04_28_booking_groups_delete_abandoned.sql` (one extra
`DELETE` RLS policy on `booking_groups`).

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env.local` in the project root:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and replace the placeholder values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   Optionally add `SUPABASE_SERVICE_ROLE_KEY` for server routes such as mock payment (`src/lib/env.ts` documents optional server usage).

## Step 4: Install Dependencies & Run

```bash
npm install
npm run dev
```

Optionally run **`npm run audit`** to verify `.env.example`, doc links, and migration files align with the repo.

The app will be available at `http://localhost:3000`.

---

## Step 5: Create an Agency Admin

The schema intentionally prevents users from self-promoting to `agency_admin`
(or from inserting their own row in `public.agencies`). All agency onboarding
flows through a review queue:

1. Pick **one** account in `public.users` and promote it to `super_admin` from
   the SQL Editor (one-time bootstrap):

   ```sql
   UPDATE public.users
   SET role = 'super_admin'
   WHERE email = 'you@example.com';
   ```

2. Have the prospective agency owner register normally as a passenger, then
   visit `/dashboard/agency-application` and submit their agency details.
3. Sign in as the super-admin and review the application at
   `/admin/applications`. Clicking **Approve** calls the
   `approve_agency_application` RPC, which atomically:
   - creates the `agencies` row,
   - sets the user's `role` to `agency_admin` and links `agency_id`,
   - marks the application `approved`.
4. The new agency admin can sign in and manage fleet/schedules at `/admin`,
   publish corridors at **`/admin/routes`** (stored in **`agency_routes`** until verified).
5. Super-admins verify route listings at **`/admin/super/routes`** before they appear on the public **`/routes`** explorer (verified + active rows).

---

## Architecture Overview

### Frontend Stack
- **Next.js 16** (App Router) with TypeScript
- **Tailwind CSS v4** with custom "Solid" design tokens
- **Zustand** for client-side state management
- **Lucide React** for icons

### Backend (Supabase)
- **Authentication**: Supabase Auth (email/password)
- **Database**: PostgreSQL with RLS for data isolation
- **Real-time**: Postgres Changes for live seat updates

### Key Flows

| Flow | Description |
|------|-------------|
| Search | User selects origin, destination, date -> trips listed |
| Booking | Select trip -> pick seats on grid -> enter passenger info -> confirm |
| Ticket | Booking generates unique code -> viewable/printable ticket |
| Check-In | Agency admin searches booking code -> marks as checked_in |
| Real-time | Seat grid updates live when others book (Supabase Realtime) |
| Routes | Agency corridors `/admin/routes` → super `/admin/super/routes` → public `/routes` |

### Database Schema (Simplified)

```
users ──< agencies (owner)
agencies ──< buses
agencies ──< trips ──< bookings >── users
agencies ──< agency_routes (verified listings for /routes)
cities ──── trips (origin/destination FK)
cities ──── agency_routes (origin/destination FK)
buses ──── bus_locations
```

### Row Level Security

- **Passengers** can only read/update their own profile and bookings
- **Agency Admins** can manage their own agency's buses, trips, and bookings
- **Trips/Buses** are publicly readable (for search) but only writable by the owning agency
- **Bookings** use a UNIQUE constraint on `(trip_id, seat_number)` to prevent double-booking at the database level

---

## Color Palette (Solid Design)

| Token | Hex | Usage |
|-------|-----|-------|
| Navy 800 | `#1e293b` | Primary dark, headers, text |
| Navy 500 | `#64748b` | Secondary text, borders |
| Primary 700 | `#15803d` | Forest Green - CTAs, active states |
| Action 700 | `#1d4ed8` | Royal Blue - secondary actions |
| White | `#ffffff` | Backgrounds, cards |

No gradients. No emojis. Sharp borders. High contrast.

---

## Project Structure

See **`README.md`** for the full tree. Highlights:

- **`src/app/routes/page.tsx`** — public route explorer  
- **`src/app/admin/routes/page.tsx`** — agency-managed corridors (`agency_routes`)  
- **`src/app/admin/super/routes/page.tsx`** — super-admin verification  
- **`supabase/migrations/`** — incremental SQL applied after `schema.sql`

```
supabase/
  schema.sql                   # Bootstrap schema + RLS + seeds
  migrations/*.sql             # Incremental changes (agency routes, staff RLS, …)
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Invalid API key" | Check `.env.local` values match your Supabase project |
| Empty search results | Ensure `cities` and `trips` tables have data (run schema.sql) |
| RLS blocking queries | Check you're authenticated; RLS policies require `auth.uid()` |
| Admin page redirects | User must have `role = 'agency_admin'` and a linked `agency_id` |
| Routes empty after approval | Run migration `agency_routes`; verify rows are `verified` + `is_active` |
| Seat not updating | Verify Supabase Realtime is enabled for the `bookings` table |

## Production: remaining work

Feature parity for bookings, admin, routes, and RLS is in place. **The only major
gap before a live launch is real payment integration:** replace
`/api/payments/mock-confirm` with verified PSP webhooks (see **`README.md` →
“Replacing the mock payment”**). Until then, passengers confirm via WhatsApp;
the booking page exposes a **mock** pay action for testing only.

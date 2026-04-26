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
4. Click **Run** to execute. This creates:
   - Tables: `users`, `agencies`, `cities`, `buses`, `trips`, `bookings`, `bus_locations`
   - Indexes for fast queries
   - Triggers for seat availability and timestamps
   - Row Level Security (RLS) policies
   - Seed data for 20 Cameroon cities

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

## Step 4: Install Dependencies & Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Step 5: Create an Agency Admin (Manual Setup)

To use the admin dashboard, you need an agency and an admin user:

1. Register a new account via the app with the **Agency Admin** role.
2. In the Supabase SQL Editor, insert an agency linked to that user:

```sql
-- Replace with the actual user ID from auth.users
INSERT INTO public.agencies (name, slug, phone, address, city, owner_id)
VALUES (
  'Your Agency Name',
  'your-agency-slug',
  '+237 600000000',
  '123 Main Street, Douala',
  'Douala',
  'USER_ID_FROM_AUTH'
);

-- Link the user to the agency
UPDATE public.users
SET agency_id = (SELECT id FROM public.agencies WHERE slug = 'your-agency-slug')
WHERE id = 'USER_ID_FROM_AUTH';
```

3. Log in with that account and navigate to `/admin`.

---

## Architecture Overview

### Frontend Stack
- **Next.js 14** (App Router) with TypeScript
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
| Ticket | Booking generates unique 8-char code -> viewable/printable ticket |
| Check-In | Agency admin searches booking code -> marks as checked_in |
| Real-time | Seat grid updates live when others book (Supabase Realtime) |

### Database Schema (Simplified)

```
users ──< agencies (owner)
agencies ──< buses
agencies ──< trips ──< bookings >── users
cities ──── trips (origin/destination FK)
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

```
src/
  app/
    page.tsx                    # Landing + search form
    search/page.tsx             # Search results
    book/[tripId]/page.tsx      # Seat selection + booking
    ticket/[code]/page.tsx      # Ticket view/print
    dashboard/page.tsx          # Passenger dashboard
    admin/
      page.tsx                  # Agency overview
      fleet/page.tsx            # Bus management
      schedules/page.tsx        # Trip scheduling
      bookings/page.tsx         # Booking management + check-in
      revenue/page.tsx          # Revenue analytics
    auth/
      login/page.tsx            # Sign in
      register/page.tsx         # Register
  components/
    layout/                     # Navbar, Footer, AdminSidebar
    ui/                         # Button, Input, Select, Card, Badge, SeatGrid, TripCard, TicketCard, Loading
  lib/
    supabase.ts                 # Client-side Supabase instance
    supabase-server.ts          # Server-side Supabase instance
    utils.ts                    # Formatting helpers
  store/
    booking-store.ts            # Zustand store for booking flow
  types/
    index.ts                    # TypeScript interfaces
supabase/
  schema.sql                   # Full database schema + RLS + seed data
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Invalid API key" | Check `.env.local` values match your Supabase project |
| Empty search results | Ensure `cities` and `trips` tables have data (run schema.sql) |
| RLS blocking queries | Check you're authenticated; RLS policies require `auth.uid()` |
| Admin page redirects | User must have `role = 'agency_admin'` and a linked `agency_id` |
| Seat not updating | Verify Supabase Realtime is enabled for the `bookings` table |

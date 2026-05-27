# SafeRide — How This System Works

This document explains how the product is wired together: persistence, APIs, libraries, and the main passenger and admin flows. For environment setup and database bootstrap, see [**`HOW_TO_CONNECT.md`**](./HOW_TO_CONNECT.md).

---

## What You Are Running

SafeRide is a **Next.js 16** (App Router) front end talking to **Supabase** (PostgreSQL + Auth + Row Level Security + Realtime). Most “business logic” for who can read or write what lives in **RLS policies and triggers**, not only in React.

| Layer | Role |
| ------ | ------ |
| `src/app/**` | Pages and routes; client components where interactivity is needed |
| `src/lib/**` | Supabase clients, env validation, RBAC helpers, PDF builder, formatting |
| `src/store/booking-store.ts` | Ephemeral UI state during search → seat selection (Zustand) |
| `supabase/schema.sql` + `migrations/` | Tables, defaults, triggers, RPCs, RLS |

---

## Identity and Route Protection

- **Supabase Auth** handles signup, login, sessions, email flows (`src/app/auth/**`, callback handler).
- **Middleware** (`src/middleware.ts`) redirects unauthenticated users away from **`/dashboard`** and **`/admin`** to `/auth/login`, passing `redirectTo`. It only checks for Supabase session cookies — full role checks happen in UI and queries.
- **Roles** (`public.users.role`: `passenger`, `agency_admin`, `super_admin`, etc.) gate admin screens (`src/lib/rbac.ts`) and complement RLS on the database.

---

## Booking Model: Groups, Rows, Codes

Checkout is modeled as:

1. A **`booking_groups`** row: one payer/checkout session (`group_code`), total amount (maintained by triggers).
2. One **`bookings`** row per seat: links `trip_id`, `user_id`, passenger fields, amounts, **`booking_code`**.

Codes are assigned **inside PostgreSQL** when each booking row is inserted — the app never invents codes in TypeScript:

```sql
booking_code TEXT UNIQUE NOT NULL DEFAULT (
  upper(translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'XYZ'))
);
```

So each seat gets its own immutable code; staff and passengers search by it. **`booking_code`** (and several other columns) cannot be rewritten after insert — enforced by trigger.

The book flow (**`src/app/book/[tripId]/page.tsx`**) inserts a group, then inserts one booking per selected seat, then redirects to **`/booking/[group_code]`** for summary and mock payment.

---

## Search → Trip → Seats

| Step | Behavior |
| ---- | --------- |
| Search | Passenger picks cities and date (`search/page.tsx`), results list trips (`TripCard`, etc.). |
| Trip detail / book | Loads trip + bus **`seat_layout`**, merges with **`bookings`** for occupied seats (`book/[tripId]/page.tsx`). |
| Duplicate seats | Postgres **`UNIQUE (trip_id, seat_number)`** returns an error if two users race; UI surfaces a toast. |

**Zustand** (`src/store/booking-store.ts`) holds selected trip, selected seats, layout, occupied seats — only for the current booking session.

---

## Real-Time Seat Updates

When other users confirm seats, the grid can refresh from **Supabase Realtime** (Postgres changes on `bookings`). The booking page subscribes and updates **`occupiedSeats`** so selections stay realistic. Helpers live beside the **`SeatGrid`** usage in **`book/[tripId]/page.tsx`**; **`RealTimeTracker`** (`src/components/booking/RealTimeTracker.tsx`) ties into trip/bus location where used.

---

## Tickets: QR, Print, PDF

### Public ticket page (`/ticket/[code]`)

- **`src/app/ticket/[code]/page.tsx`**: Loads the **`bookings`** row by **`booking_code`** from the URL (with trip and related rows).
- **`react-qr-code`**: Draws an on-screen QR for the booking code — no deprecated Google Charts image API.

### Printable view

**`window.print()`** prints the styled ticket; **`print:`** Tailwind modifiers hide chrome where needed.

### Downloadable PDF (vector, not screenshots)

Instead of **`html2canvas`** (DOM snapshot — fragile with Tailwind v4/CSS `lab()` colors and pulls in another dependency):

- **`src/lib/ticket-pdf.ts`** builds the PDF entirely with **`jspdf`** and draws text, rectangles, lines, amounts.
- **QR inside the PDF** uses the **`qrcode`** package (**`QRCode.toDataURL`**) to embed a raster QR as PNG bytes in the PDF.
- **`saveTicketPdf(booking)`** invokes **`buildTicketPdf`**, then **`pdf.save(...)`**.

This matches the **`README`** / **`HOW_TO_CONNECT`** note about avoiding screenshot-based PDF pipelines for predictable output.

---

## Payments (Development vs Production)

- **`POST /api/payments/mock-confirm`** (`src/app/api/payments/mock-confirm/route.ts`): For testing, verifies the caller’s Supabase session and marks a **`booking_group`** (and its bookings) **`paid`** using the **service-role** client when **`SUPABASE_SERVICE_ROLE_KEY`** is set.
- **Production**: Replace this route’s implementation with webhook handlers from Mobile Money / PayPal etc., with signature verification and the same transactional updates (`README.md` expands this).

The booking-group page **`/booking/[code]`** points users at mock confirm until a real PSP is integrated.

---

## Agency Admin and Super Admin

| Area | Route(s) | Data / tooling |
| ---- | --------- | ------------- |
| Fleet, schedules, bookings | **`/admin/*`** | Supabase **`agencies`**, **`buses`**, **`trips`**, **`bookings`** under RLS for the owning agency |
| Corridor listings | **`/admin/routes`**, moderation **`/admin/super/routes`**, public **`/routes`** | **`agency_routes`** + migrations (see **`HOW_TO_CONNECT.md`**) |
| Applications | **`/admin/applications`**, **`/dashboard/agency-application`** | **`agency_applications`**, **`approve_agency_application`** RPC |
| Voice / metrics | **`/admin/agency`**, **`/admin/revenue`**, **`/admin/super`** | Reads constrained by role + RLS |

Check-in UX on **`admin/bookings`** resolves a passenger by **`booking_code`** search and updates **`status`** to **`checked_in`**.

---

## Feedback in the UI

- **`sonner`** is the toaster; **`src/lib/toast.ts`** wraps **`toast` / toastError`** for consistent errors (e.g. PDF failures).

---

## Security (Short List)

Detailed rules live in **`README.md` → Security notes**. Highlights:

- RLS restricts reads/writes by role and ownership.
- Passengers insert **`bookings`** with **`payment_status = pending`** only; amounts must match **`trip.price`**.
- Agencies cannot mint arbitrary **`agencies`** rows; approval goes through **`approve_agency_application`**.
- Service role is **server-only** — never bundled to the browser (`src/lib/supabase-server.ts`).

---

## File Map (Features → Code)

| Feature | Primary location |
| --------- | ----------------- |
| Env validation | `src/lib/env.ts` |
| Browser Supabase | `src/lib/supabase.ts` |
| Service-role / server Supabase | `src/lib/supabase-server.ts` |
| RBAC helpers | `src/lib/rbac.ts` |
| PDF ticket | `src/lib/ticket-pdf.ts` |
| Booking flow state | `src/store/booking-store.ts` |
| Seat selection & insert | `src/app/book/[tripId]/page.tsx` |
| Group summary / mock pay | `src/app/booking/[code]/page.tsx` |
| Ticket QR / download PDF | `src/app/ticket/[code]/page.tsx` |
| Auth gate | `src/middleware.ts` |
| Mock payment API | `src/app/api/payments/mock-confirm/route.ts` |
| Schema defaults (e.g. **`booking_code`**) | `supabase/schema.sql` |

---

## Related Documentation

| Document | Use when |
| -------- | -------- |
| **`HOW_TO_CONNECT.md`** | First-time Supabase setup, migrations, bootstrap super-admin |
| **`README.md`** | Full tree, migrations table, replacing mock payments, stack |
| **`supabase/schema.sql`** | Canonical table DDL, triggers, RLS |

---

_Last updated alongside the SafeRide repo; adjust this file when you change flows or libraries._

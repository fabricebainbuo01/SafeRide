"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, getSessionUser } from "@/lib/supabase";
import { TicketCard } from "@/components/ui/TicketCard";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Loading";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { Booking, User } from "@/types";
import {
  Ticket,
  Clock,
  CheckCircle,
  MapPin,
  Briefcase,
  Building2,
} from "lucide-react";

interface BookingStats {
  totalBookings: number;
  activeTickets: number;
  checkedIn: number;
  routesTraveled: number;
}

async function fetchBookingStats(
  client: SupabaseClient,
  userId: string
): Promise<BookingStats> {
  const [
    totalRes,
    activeRes,
    checkedRes,
    routesRes,
  ] = await Promise.all([
    client
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["confirmed", "checked_in"]),
    client
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "checked_in"),
    client
      .from("bookings")
      .select("trip_id")
      .eq("user_id", userId)
      .eq("status", "checked_in"),
  ]);

  const routesTraveled =
    routesRes.error || !routesRes.data?.length
      ? 0
      : new Set(routesRes.data.map((r) => r.trip_id)).size;

  return {
    totalBookings: totalRes.count ?? 0,
    activeTickets: activeRes.count ?? 0,
    checkedIn: checkedRes.count ?? 0,
    routesTraveled,
  };
}

function ActiveTicketsEmptyIllustration() {
  return (
    <div
      className="mx-auto mb-6 flex h-44 max-w-[280px] items-center justify-center text-primary-700/25"
      aria-hidden
    >
      <svg viewBox="0 0 240 180" fill="none" className="h-full w-full">
        <rect
          x="28"
          y="42"
          width="184"
          height="112"
          rx="14"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M56 42v112M112 42v112M168 42v112"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity="0.45"
        />
        <circle cx="120" cy="98" r="26" stroke="currentColor" strokeWidth="2" fill="none" />
        <path
          d="M108 98h24M120 86v24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="72" y="22" width="96" height="18" rx="4" fill="currentColor" opacity="0.2" />
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats>({
    totalBookings: 0,
    activeTickets: 0,
    checkedIn: 0,
    routesTraveled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  const loadDashboard = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    const authUser = await getSessionUser(client);
    if (!authUser) {
      router.push("/auth/login");
      return;
    }

    const [profileRes, bookingsResult, statsResult] = await Promise.all([
      client.from("users").select("*").eq("id", authUser.id).maybeSingle(),
      client
        .from("bookings")
        .select(
          `*, trip:trips(id, departure_date, departure_time, estimated_arrival_time, price, currency, status, origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name), agency:agencies(id, name))`
        )
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false }),
      fetchBookingStats(client, authUser.id),
    ]);

    if (profileRes.error) toastError(profileRes.error, "Couldn't load profile");
    else if (profileRes.data)
      setUser(profileRes.data as unknown as User);

    if (bookingsResult.error) {
      toastError(bookingsResult.error, "Couldn't load bookings");
    } else if (bookingsResult.data) {
      setBookings(bookingsResult.data as unknown as Booking[]);
    }
    setStats(statsResult);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Real-time updates for bookings — null-safe.
  // The `cancelled` + unique channel-name pattern is needed because
  // (a) React 18 StrictMode mounts effects twice in dev, and
  // (b) Use getSessionUser (serialized getSession) instead of getUser() so
  //     concurrent calls don't race Supabase Auth's internal lock.
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;

    void getSessionUser(client).then((authUser) => {
      if (cancelled || !authUser) return;

      channel = client
        .channel(`user-${authUser.id}-bookings-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `user_id=eq.${authUser.id}`,
          },
          () => {
            void loadDashboard();
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) client.removeChannel(channel);
    };
  }, [loadDashboard]);

  const activeTickets = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "checked_in"
  );
  const historyBookings = bookings.filter(
    (b) => b.status === "cancelled" || b.status === "no_show"
  );

  const displayBookings =
    activeTab === "active" ? activeTickets : historyBookings;

  const welcomeFirstName =
    user?.full_name?.trim().split(/\s+/)[0] ?? "";

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <header className="mb-8 flex flex-col gap-4 border-b border-navy-100 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-navy-800 sm:text-2xl">
            {welcomeFirstName
              ? `Welcome back, ${welcomeFirstName}!`
              : "Welcome back!"}
          </h1>
          {user && (
            <div className="flex flex-col gap-1 text-sm text-navy-600 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-1">
              {user.email && (
                <span className="truncate">
                  <span className="text-navy-400">Email </span>
                  {user.email}
                </span>
              )}
              <span>
                <span className="text-navy-400">Phone </span>
                {user.phone}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/dashboard/profile"
            className="text-xs font-medium text-primary-700 hover:underline sm:text-sm"
          >
            Edit profile
          </Link>
          {user?.role === "agency_admin" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-primary-700 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 sm:text-sm"
            >
              <Briefcase size={14} />
              Agency portal
            </Link>
          )}
        </div>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          padding={false}
          className="flex items-center gap-3 rounded-xl border-navy-200/80 p-4 shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-action-100">
            <Ticket size={18} className="text-action-700" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-navy-400">Total bookings</p>
            <p className="text-lg font-bold tabular-nums text-navy-800">
              {stats.totalBookings}
            </p>
          </div>
        </Card>
        <Card
          padding={false}
          className="flex items-center gap-3 rounded-xl border-navy-200/80 p-4 shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100">
            <CheckCircle size={18} className="text-primary-700" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-navy-400">Active tickets</p>
            <p className="text-lg font-bold tabular-nums text-navy-800">
              {stats.activeTickets}
            </p>
          </div>
        </Card>
        <Card
          padding={false}
          className="flex items-center gap-3 rounded-xl border-navy-200/80 p-4 shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-100">
            <Clock size={18} className="text-navy-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-navy-400">Checked in</p>
            <p className="text-lg font-bold tabular-nums text-navy-800">
              {stats.checkedIn}
            </p>
          </div>
        </Card>
        <Card
          padding={false}
          className="flex items-center gap-3 rounded-xl border-navy-200/80 p-4 shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-100">
            <MapPin size={18} className="text-navy-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-navy-400">Routes traveled</p>
            <p className="text-lg font-bold tabular-nums text-navy-800">
              {stats.routesTraveled}
            </p>
          </div>
        </Card>
      </div>

      {user?.role === "passenger" && (
        <Card
          padding={false}
          className="mb-8 flex flex-col gap-4 rounded-xl border-primary-200 bg-gradient-to-br from-primary-50/90 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100">
              <Building2 className="text-primary-700" size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-navy-800">
                List your transport agency on SafeRide
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-navy-600">
                Submit an application — only a platform administrator can approve it. You’ll
                manage fleet, schedules, and bookings from the agency portal once approved.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => window.location.assign("/agency-application")}
          >
            Apply to list your agency
          </Button>
        </Card>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-navy-200">
        <button
          type="button"
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "active"
              ? "border-primary-700 text-primary-700"
              : "border-transparent text-navy-500 hover:text-navy-700"
          }`}
          onClick={() => setActiveTab("active")}
        >
          Active tickets ({stats.activeTickets})
        </button>
        <button
          type="button"
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-primary-700 text-primary-700"
              : "border-transparent text-navy-500 hover:text-navy-700"
          }`}
          onClick={() => setActiveTab("history")}
        >
          History ({historyBookings.length})
        </button>
      </div>

      {displayBookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/50 px-4 py-14 text-center sm:py-16">
          {activeTab === "active" ? (
            <>
              <ActiveTicketsEmptyIllustration />
              <p className="mb-2 text-base font-semibold text-navy-800">
                No active tickets yet
              </p>
              <p className="mx-auto mb-6 max-w-sm text-sm text-navy-500">
                When you book a trip, your tickets show up here with live updates.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/book-tickets"
                  className={cn(
                    "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-700",
                    "bg-primary-700 text-white hover:bg-primary-800",
                    "hover-scale active-scale px-4 py-2 text-sm"
                  )}
                >
                  Book a ticket
                </Link>
                {user?.role === "passenger" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.assign("/agency-application")}
                  >
                    Apply to list your agency
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <Ticket
                size={32}
                className="mx-auto mb-3 text-navy-300"
                aria-hidden
              />
              <p className="text-sm text-navy-500">No cancelled or past no-shows.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {displayBookings.map((booking) => (
            <TicketCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

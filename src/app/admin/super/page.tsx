"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Building2,
  DollarSign,
  Train,
  Activity,
  Loader2,
  Ban,
  CheckCircle,
  Eye,
  MessageCircle,
  TrendingUp,
  Coins,
  AlertTriangle,
} from "lucide-react";

/**
 * Best-effort detection of "schema not migrated yet" errors from supabase-js.
 * Covers both the PostgREST schema-cache message and raw Postgres errors:
 *   * 42P01 — relation does not exist
 *   * 42703 — column does not exist
 *   * PGRST205 — schema cache miss (typical for tables not yet present)
 */
function isMissingSchema(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = error.message ?? "";
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    /Could not find the (table|column)/i.test(msg) ||
    /does not exist/i.test(msg)
  );
}
import { getSupabase, getSessionUser } from "@/lib/supabase";
import {
  fetchUserProfile,
  isSuperAdmin,
  type UserProfileRow,
} from "@/lib/rbac";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { formatCurrency } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";

interface RecentRow {
  id: string;
  created_at: string;
  booking_code: string;
  passenger_name: string;
  seat_number: number;
  amount: number;
  payment_status: string;
  agency_name: string;
}

interface AgencyRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  phone: string;
  is_active: boolean;
  subscription_status: "paid" | "overdue";
}

interface BIStats {
  totalTraffic: number;
  bookingLeads: number;
  estimatedCommissionXaf: number;
}

/** XAF earned by SafeRide per WhatsApp lead. Drives the BI commission tile. */
const COMMISSION_PER_LEAD_XAF = 300;

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [agencyCount, setAgencyCount] = useState(0);
  const [activeTrips, setActiveTrips] = useState(0);
  const [health, setHealth] = useState<{ ok: boolean; ms: number }>({
    ok: true,
    ms: 0,
  });

  const [chartData, setChartData] = useState<{ day: string; revenue: number }[]>(
    []
  );
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const [bi, setBi] = useState<BIStats>({
    totalTraffic: 0,
    bookingLeads: 0,
    estimatedCommissionXaf: 0,
  });
  /**
   * Becomes `true` whenever any new-schema query (subscription_status,
   * page_views, leads_tracking, agency_routes.is_featured) returns a
   * "missing table/column" error. Renders a single banner instead of N noisy
   * toasts and gives the operator the exact file path to run.
   */
  const [migrationMissing, setMigrationMissing] = useState(false);

  const statsRefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;

    const t0 = performance.now();
    const ping = await client.from("cities").select("id").limit(1);
    const ms = Math.round(performance.now() - t0);
    setHealth({ ok: !ping.error, ms });

    const [{ count: ac }, { count: at }, paidRes] = await Promise.all([
      client.from("agencies").select("*", { count: "exact", head: true }),
      client
        .from("trips")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .in("status", ["scheduled", "boarding", "departed"]),
      client.from("bookings").select("amount").eq("payment_status", "paid"),
    ]);

    setAgencyCount(ac ?? 0);
    setActiveTrips(at ?? 0);
    const rev =
      paidRes.data?.reduce((s, b) => s + (Number(b.amount) || 0), 0) ?? 0;
    setTotalRevenue(rev);

    const from = new Date();
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const { data: paidWeek } = await client
      .from("bookings")
      .select("amount, created_at")
      .eq("payment_status", "paid")
      .gte("created_at", from.toISOString());

    const byDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split("T")[0]!;
      byDay[key] = 0;
    }
    paidWeek?.forEach((b) => {
      const day = b.created_at.split("T")[0]!;
      if (day in byDay) byDay[day] += Number(b.amount) || 0;
    });
    setChartData(
      Object.entries(byDay).map(([day, revenue]) => ({
        day: day.slice(5),
        revenue,
      }))
    );
  }, []);

  const debouncedLoadStats = useCallback(() => {
    if (statsRefetchTimer.current) clearTimeout(statsRefetchTimer.current);
    statsRefetchTimer.current = setTimeout(() => {
      void loadStats();
    }, 400);
  }, [loadStats]);

  const loadRecent = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    const { data, error } = await client
      .from("bookings")
      .select(
        `id, created_at, booking_code, passenger_name, seat_number, amount, payment_status,
        trip:trips(agency:agencies(name))`
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toastError(error, "Couldn't load recent bookings");
      return;
    }
    const rows: RecentRow[] = (data ?? []).map((r: Record<string, unknown>) => {
      const trip = r.trip as
        | { agency: { name: string } | { name: string }[] | null }
        | undefined;
      const ag = trip?.agency;
      const agencyName = Array.isArray(ag)
        ? ag[0]?.name
        : ag?.name ?? "—";
      return {
        id: r.id as string,
        created_at: r.created_at as string,
        booking_code: r.booking_code as string,
        passenger_name: r.passenger_name as string,
        seat_number: r.seat_number as number,
        amount: Number(r.amount),
        payment_status: r.payment_status as string,
        agency_name: agencyName,
      };
    });
    setRecent(rows);
  }, []);

  const loadAgencies = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;

    // Try the post-migration shape first.
    const newShape = await client
      .from("agencies")
      .select("id, name, slug, city, phone, is_active, subscription_status")
      .order("name");

    if (!newShape.error) {
      setAgencies((newShape.data ?? []) as AgencyRow[]);
      return;
    }

    // Pre-migration fallback: the `subscription_status` column doesn't exist
    // yet. Retry without it and default everyone to 'paid' so the table still
    // renders. The banner will guide the operator to run the migration.
    if (isMissingSchema(newShape.error)) {
      setMigrationMissing(true);
      const oldShape = await client
        .from("agencies")
        .select("id, name, slug, city, phone, is_active")
        .order("name");
      if (oldShape.error) {
        toastError(oldShape.error, "Couldn't load agencies");
        return;
      }
      const rows = (oldShape.data ?? []).map((a) => ({
        ...a,
        subscription_status: "paid" as const,
      }));
      setAgencies(rows as AgencyRow[]);
      return;
    }

    toastError(newShape.error, "Couldn't load agencies");
  }, []);

  /**
   * Business Intelligence stats:
   *   * Total Traffic — row count of public.page_views
   *   * Booking Leads — row count of public.leads_tracking where kind='whatsapp_confirm'
   *   * Estimated Commission — leads × COMMISSION_PER_LEAD_XAF
   *
   * Both queries use `head: true` so Supabase returns only the count, never
   * the rows — important because page_views grows quickly.
   */
  const loadBI = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;

    // Booking Leads now spans all four monetisable surfaces:
    //   whatsapp_confirm + ticket_download + ticket_print + qr_scan
    // → no `kind` filter; the table only ever holds these values (CHECK
    // constraint enforces it server-side).
    const [trafficRes, leadsRes] = await Promise.all([
      client.from("page_views").select("id", { count: "exact", head: true }),
      client
        .from("leads_tracking")
        .select("id", { count: "exact", head: true }),
    ]);

    // Surface the "missing migration" banner without spamming toasts, then
    // treat the absent tables as zero so the rest of the dashboard still
    // renders normally.
    const trafficMissing = isMissingSchema(trafficRes.error);
    const leadsMissing = isMissingSchema(leadsRes.error);
    if (trafficMissing || leadsMissing) {
      setMigrationMissing(true);
    }
    if (trafficRes.error && !trafficMissing) {
      toastError(trafficRes.error, "Couldn't load traffic");
    }
    if (leadsRes.error && !leadsMissing) {
      toastError(leadsRes.error, "Couldn't load leads");
    }

    const totalTraffic = trafficMissing ? 0 : trafficRes.count ?? 0;
    const bookingLeads = leadsMissing ? 0 : leadsRes.count ?? 0;
    setBi({
      totalTraffic,
      bookingLeads,
      estimatedCommissionXaf: bookingLeads * COMMISSION_PER_LEAD_XAF,
    });
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    (async () => {
      const client = getSupabase();
      if (!client) {
        setReady(true);
        setLoading(false);
        return;
      }
      const authUser = await getSessionUser(client);
      if (signal.cancelled) return;
      if (!authUser) {
        router.replace("/auth/login");
        return;
      }
      const { data: p } = await fetchUserProfile(client, authUser.id);
      if (signal.cancelled) return;
      if (!isSuperAdmin(p)) {
        toast.error("Access denied", "Super admin only.");
        router.replace("/dashboard");
        return;
      }
      setProfile(p);
      setReady(true);
      await Promise.all([loadStats(), loadRecent(), loadAgencies(), loadBI()]);
      if (!signal.cancelled) setLoading(false);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [router, loadStats, loadRecent, loadAgencies, loadBI]);

  useEffect(() => {
    if (!ready || !profile) return;
    const client = getSupabase();
    if (!client) return;

    const ch = client
      .channel(`super-dash-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        () => {
          void loadRecent();
          debouncedLoadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings" },
        () => {
          debouncedLoadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => {
          debouncedLoadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads_tracking" },
        () => {
          void loadBI();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(ch);
    };
  }, [ready, profile, loadRecent, debouncedLoadStats, loadStats, loadBI]);

  const toggleAgency = async (row: AgencyRow) => {
    const client = getSupabase();
    if (!client) return;
    setActingId(row.id);
    const next = !row.is_active;
    const { error } = await client
      .from("agencies")
      .update({ is_active: next })
      .eq("id", row.id);
    setActingId(null);
    if (error) {
      toastError(error, "Update failed");
      return;
    }
    toast.success(next ? "Agency activated" : "Agency suspended");
    setAgencies((prev) =>
      prev.map((a) => (a.id === row.id ? { ...a, is_active: next } : a))
    );
    debouncedLoadStats();
  };

  /** Toggle subscription paid ⇄ overdue. Optimistic; rollbacks on failure. */
  const toggleSubscription = async (row: AgencyRow) => {
    const client = getSupabase();
    if (!client) return;
    if (migrationMissing) {
      toast.error(
        "Migration not applied",
        "Run supabase/migrations/2026_05_06_bi_leads_and_featured.sql first."
      );
      return;
    }
    const next: "paid" | "overdue" =
      row.subscription_status === "paid" ? "overdue" : "paid";
    setActingId(row.id);
    setAgencies((prev) =>
      prev.map((a) =>
        a.id === row.id ? { ...a, subscription_status: next } : a
      )
    );
    const { error } = await client
      .from("agencies")
      .update({ subscription_status: next })
      .eq("id", row.id);
    setActingId(null);
    if (error) {
      if (isMissingSchema(error)) {
        setMigrationMissing(true);
      }
      toastError(error, "Couldn't update subscription");
      setAgencies((prev) =>
        prev.map((a) =>
          a.id === row.id
            ? { ...a, subscription_status: row.subscription_status }
            : a
        )
      );
      return;
    }
    toast.success(
      next === "paid" ? "Marked as paid" : "Marked as overdue",
      `${row.name} subscription updated.`
    );
  };

  /**
   * Builds the WhatsApp deep-link for the "Account Manager" CTA.
   * Strips everything except digits and the leading '+', so phones like
   * "+237 6 83 07 36 01" resolve to a valid `wa.me` number.
   */
  const whatsappLinkFor = (row: AgencyRow) => {
    const digits = (row.phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    const prefill = encodeURIComponent(
      `Hi ${row.name}, this is the SafeRide Account Manager.`
    );
    return digits
      ? `https://wa.me/${digits}?text=${prefill}`
      : null;
  };

  const healthLabel = useMemo(() => {
    if (!health.ok) return "Degraded";
    if (health.ms > 800) return "Slow";
    return "OK";
  }, [health]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-700" size={32} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex">
        <AdminSidebar variant="super" />
        <div className="flex-1 p-8">
          <LoadingSkeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <LoadingSkeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar variant="super" />
      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-navy-800 mb-2">Super dashboard</h1>
        <p className="text-sm text-navy-500 mb-8">
          Global platform metrics, live bookings, and agency visibility.
        </p>

        {/* ============== Business Intelligence ============== */}
        <section className="mb-10">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-navy-800">
                Business Intelligence
              </h2>
              <p className="text-xs text-navy-400 mt-0.5">
                Traffic & monetisation telemetry. Leads earn{" "}
                {formatCurrency(COMMISSION_PER_LEAD_XAF)} each.
              </p>
            </div>
          </div>
          {migrationMissing && (
            <div className="mb-4 flex items-start gap-3 border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-yellow-600"
              />
              <div className="text-yellow-900">
                <p className="font-semibold">BI migration not applied yet</p>
                <p className="mt-0.5 text-yellow-800">
                  Open Supabase → SQL Editor and run{" "}
                  <code className="rounded bg-yellow-100 px-1 py-0.5 text-[11px]">
                    supabase/migrations/2026_05_06_bi_leads_and_featured.sql
                  </code>
                  . The dashboard is rendering fallback values until the
                  <code className="ml-1 rounded bg-yellow-100 px-1 py-0.5 text-[11px]">
                    page_views
                  </code>
                  ,{" "}
                  <code className="rounded bg-yellow-100 px-1 py-0.5 text-[11px]">
                    leads_tracking
                  </code>{" "}
                  tables and{" "}
                  <code className="rounded bg-yellow-100 px-1 py-0.5 text-[11px]">
                    agencies.subscription_status
                  </code>{" "}
                  column exist.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-action-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-action-100 flex items-center justify-center rounded">
                  <Eye className="text-action-700" size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-navy-400">Total traffic</p>
                  <p className="text-lg font-bold text-navy-800 tabular-nums">
                    {bi.totalTraffic.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-navy-400">page views (excl. /admin)</p>
                </div>
              </div>
            </Card>
            <Card className="border-l-4 border-l-primary-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 flex items-center justify-center rounded">
                  <TrendingUp className="text-primary-700" size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-navy-400">Booking leads</p>
                  <p className="text-lg font-bold text-navy-800 tabular-nums">
                    {bi.bookingLeads.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-navy-400">
                    WhatsApp + downloads + prints + QR scans
                  </p>
                </div>
              </div>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 flex items-center justify-center rounded">
                  <Coins className="text-yellow-700" size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-navy-400">Estimated commission</p>
                  <p className="text-lg font-bold text-navy-800 tabular-nums">
                    {formatCurrency(bi.estimatedCommissionXaf)}
                  </p>
                  <p className="text-[10px] text-navy-400">
                    leads × {formatCurrency(COMMISSION_PER_LEAD_XAF)}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 flex items-center justify-center rounded">
                <DollarSign className="text-primary-700" size={20} />
              </div>
              <div>
                <p className="text-xs text-navy-400">Total revenue (paid)</p>
                <p className="text-lg font-bold text-navy-800">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-navy-100 flex items-center justify-center rounded">
                <Building2 className="text-navy-700" size={20} />
              </div>
              <div>
                <p className="text-xs text-navy-400">Agencies</p>
                <p className="text-lg font-bold text-navy-800">{agencyCount}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-action-100 flex items-center justify-center rounded">
                <Train className="text-action-700" size={20} />
              </div>
              <div>
                <p className="text-xs text-navy-400">Active trips</p>
                <p className="text-lg font-bold text-navy-800">{activeTrips}</p>
                <p className="text-[10px] text-navy-400">
                  scheduled / boarding / departed
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 flex items-center justify-center rounded border border-primary-200">
                <Activity className="text-primary-700" size={20} />
              </div>
              <div>
                <p className="text-xs text-navy-400">System health</p>
                <p className="text-lg font-bold text-navy-800">{healthLabel}</p>
                <p className="text-[10px] text-navy-400">{health.ms} ms ping</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Revenue (last 7 days, paid)</CardTitle>
          </CardHeader>
          <div className="h-56 w-full min-w-0 min-h-[14rem]">
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  formatter={(value) =>
                    formatCurrency(
                      typeof value === "number" ? value : Number(value ?? 0)
                    )
                  }
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#059669"
                  fill="#10b981"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent bookings (all agencies)</CardTitle>
              <p className="text-xs text-navy-400 font-normal mt-1">
                Updates live via Supabase Realtime on{" "}
                <code className="text-navy-600">bookings</code> inserts.
              </p>
            </CardHeader>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-200 text-left text-navy-400">
                    <th className="py-2 pr-2">When</th>
                    <th className="py-2 pr-2">Code</th>
                    <th className="py-2 pr-2">Agency</th>
                    <th className="py-2 pr-2">Passenger</th>
                    <th className="py-2 pr-2">Seat</th>
                    <th className="py-2 pr-2">Amt</th>
                    <th className="py-2">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b border-navy-100">
                      <td className="py-2 pr-2 whitespace-nowrap text-navy-600">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">{r.booking_code}</td>
                      <td className="py-2 pr-2 max-w-[140px] truncate">{r.agency_name}</td>
                      <td className="py-2 pr-2">{r.passenger_name}</td>
                      <td className="py-2 pr-2">{r.seat_number}</td>
                      <td className="py-2 pr-2">{formatCurrency(r.amount)}</td>
                      <td className="py-2">
                        <Badge
                          variant={
                            r.payment_status === "paid"
                              ? "success"
                              : r.payment_status === "pending"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {r.payment_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-navy-400">
                        No bookings yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agency management</CardTitle>
              <p className="text-xs text-navy-400 font-normal mt-1">
                Subscription tracks billing; click the badge to toggle paid ⇄
                overdue. Account Manager opens WhatsApp to the agency owner.
              </p>
            </CardHeader>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-200 text-left text-navy-400">
                    <th className="py-2 pr-2">Agency</th>
                    <th className="py-2 pr-2">Subscription</th>
                    <th className="py-2 pr-2">Listing</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agencies.map((a) => {
                    const waLink = whatsappLinkFor(a);
                    const subPaid = a.subscription_status === "paid";
                    return (
                      <tr key={a.id} className="border-b border-navy-100">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-navy-800">{a.name}</p>
                          <p className="text-xs text-navy-400">{a.city}</p>
                        </td>
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => void toggleSubscription(a)}
                            disabled={actingId === a.id}
                            aria-label={`Toggle subscription for ${a.name}`}
                            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Badge variant={subPaid ? "success" : "danger"}>
                              {subPaid ? "Paid" : "Overdue"}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-2 pr-2">
                          <Badge variant={a.is_active ? "info" : "warning"}>
                            {a.is_active ? "Listed" : "Suspended"}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-2">
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-700 border border-primary-700 hover:bg-primary-50 transition-colors"
                                aria-label={`Message ${a.name} on WhatsApp`}
                                title="Account Manager on WhatsApp"
                              >
                                <MessageCircle size={13} />
                                Manager
                              </a>
                            ) : (
                              <span className="text-xs text-navy-400 px-2 py-1">
                                no phone
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              loading={actingId === a.id}
                              onClick={() => void toggleAgency(a)}
                              className="gap-1"
                            >
                              {a.is_active ? (
                                <>
                                  <Ban size={14} /> Suspend
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={14} /> Activate
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {agencies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-navy-400">
                        No agencies.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

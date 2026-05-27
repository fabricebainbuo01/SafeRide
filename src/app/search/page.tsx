"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useBookingStore } from "@/store/booking-store";
import { toastError } from "@/lib/toast";
import { localDateISOString } from "@/lib/utils";
import { TripCard } from "@/components/ui/TripCard";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import type { Trip } from "@/types";
import { useRouter } from "next/navigation";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

const TRIP_LIST_SELECT =
  "*, agency:agencies(id, name, slug), bus:buses(id, model, plate_number, capacity, seat_layout), origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name)";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8"><LoadingSkeleton className="h-64" /></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const originId = searchParams.get("origin");
  const destinationId = searchParams.get("destination");
  const date = searchParams.get("date");
  const agencyId = searchParams.get("agency");
  const timeId = searchParams.get("time");

  const { setSearchParams, setSelectedTrip } = useBookingStore();

  /** Narrow search from home hero uses origin + destination + date; navbar “Book Tickets” opens /search without params. */
  const fullSearch = Boolean(originId && destinationId && date);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [cities, setCities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"price" | "departure">("departure");
  /** When a narrow search returns nothing, nearest scheduled date on this route (if any). */
  const [routeHint, setRouteHint] = useState<
    { nextDate?: string; lastDate?: string } | null
  >(null);

  useEffect(() => {
    if (fullSearch) {
      setSearchParams({
        origin: originId!,
        destination: destinationId!,
        date: date!,
        agency: agencyId || "",
        time: timeId || "",
      });
    }
  }, [fullSearch, originId, destinationId, date, agencyId, timeId, setSearchParams]);

  const fetchCities = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    const { data } = await client
      .from("cities")
      .select("id, name")
      .eq("is_active", true);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((c: { id: string; name: string }) => {
        map[c.id] = c.name;
      });
      setCities(map);
    }
  }, []);

  const fetchTrips = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setRouteHint(null);

    if (!fullSearch) {
      const today = localDateISOString();
      const { data, error } = await client
        .from("trips")
        .select(TRIP_LIST_SELECT)
        .gte("departure_date", today)
        .eq("is_active", true)
        .neq("status", "cancelled")
        .gt("available_seats", 0)
        .order("departure_date", { ascending: true })
        .order("departure_time", { ascending: true })
        .limit(120);

      if (error) {
        toastError(error, "Couldn't load trips");
        setTrips([]);
      } else if (data) {
        setTrips(data as unknown as Trip[]);
      } else {
        setTrips([]);
      }
      setLoading(false);
      return;
    }

    let query = client
      .from("trips")
      .select(TRIP_LIST_SELECT)
      .eq("origin_city_id", originId!)
      .eq("destination_city_id", destinationId!)
      .eq("departure_date", date!.trim())
      .eq("is_active", true)
      .neq("status", "cancelled")
      .order("departure_time");

    if (agencyId) {
      query = query.eq("agency_id", agencyId);
    }

    if (timeId) {
      query = query.gte("departure_time", timeId);
    }

    const { data, error } = await query;

    if (error) {
      toastError(error, "Couldn't load trips");
      setTrips([]);
    } else if (data) {
      setTrips(data as unknown as Trip[]);
      if (data.length === 0) {
        const routeFilters = (q: ReturnType<typeof client.from>) =>
          q
            .select("departure_date")
            .eq("origin_city_id", originId!)
            .eq("destination_city_id", destinationId!)
            .eq("is_active", true)
            .neq("status", "cancelled");

        const { data: nextRow } = await routeFilters(client.from("trips"))
          .gte("departure_date", date!.trim())
          .order("departure_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextRow?.departure_date) {
          setRouteHint({ nextDate: nextRow.departure_date as string });
        } else {
          const { data: lastRow } = await routeFilters(client.from("trips"))
            .lte("departure_date", date!.trim())
            .order("departure_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastRow?.departure_date) {
            setRouteHint({ lastDate: lastRow.departure_date as string });
          }
        }
      }
    } else {
      setTrips([]);
    }
    setLoading(false);
  }, [fullSearch, originId, destinationId, date, agencyId, timeId]);

  useEffect(() => {
    fetchCities();
    fetchTrips();
  }, [fetchCities, fetchTrips]);

  const handleSelectTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    router.push(`/book/${trip.id}`);
  };

  const sortedTrips = [...trips].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    const byDate = a.departure_date.localeCompare(b.departure_date);
    if (byDate !== 0) return byDate;
    return a.departure_time.localeCompare(b.departure_time);
  });

  const originName = cities[originId || ""] || "Origin";
  const destName = cities[destinationId || ""] || "Destination";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-800 mb-2"
          >
            <ArrowLeft size={14} />
            {fullSearch ? "New Search" : "Home"}
          </button>
          {fullSearch ? (
            <>
              <h1 className="text-2xl font-bold text-navy-800">
                {originName} to {destName}
              </h1>
              <p className="text-sm text-navy-500 mt-1">
                {date} · {trips.length} trip{trips.length !== 1 ? "s" : ""} found
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-navy-800">Book a ticket</h1>
              <p className="text-sm text-navy-500 mt-1">
                Upcoming trips with seats · {trips.length} listing{trips.length !== 1 ? "s" : ""}. Narrow by route and date from{" "}
                <button type="button" className="text-primary-700 underline-offset-2 hover:underline" onClick={() => router.push("/")}>
                  home
                </button>
                .
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <SlidersHorizontal size={16} className="text-navy-400" />
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "price" | "departure")
            }
            className="text-sm border border-navy-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
          >
            <option value="departure">Departure Time</option>
            <option value="price">Price: Low to High</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-navy-200 p-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <LoadingSkeleton className="h-5 w-40" />
                  <LoadingSkeleton className="h-4 w-64" />
                  <LoadingSkeleton className="h-3 w-32" />
                </div>
                <div className="space-y-3">
                  <LoadingSkeleton className="h-7 w-24" />
                  <LoadingSkeleton className="h-8 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedTrips.length === 0 ? (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold text-navy-700 mb-2">
            No trips found
          </h2>
          <p className="text-sm text-navy-500 mb-4 max-w-md mx-auto">
            {fullSearch
              ? routeHint?.nextDate
                ? `Nothing on ${date}. The next departure for this route is ${routeHint.nextDate}.`
                : routeHint?.lastDate
                  ? `Nothing on ${date}. The most recent schedule for this route was ${routeHint.lastDate} — trip data may need refreshing in Supabase.`
                  : "No available trips for this route and date. Try a different date or route."
              : "No upcoming trips with seats right now. Try again later or search from home for a specific route and date."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {fullSearch && routeHint?.nextDate && (
              <Button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("date", routeHint.nextDate!);
                  router.push(`/search?${params.toString()}`);
                }}
              >
                View {routeHint.nextDate}
              </Button>
            )}
            {fullSearch && routeHint?.lastDate && !routeHint.nextDate && (
              <Button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("date", routeHint.lastDate!);
                  router.push(`/search?${params.toString()}`);
                }}
              >
                View {routeHint.lastDate}
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/")}>
              {fullSearch ? "Search Again" : "Back to home"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onSelect={handleSelectTrip}
            />
          ))}
        </div>
      )}
    </div>
  );
}

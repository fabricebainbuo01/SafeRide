"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useBookingStore } from "@/store/booking-store";
import { TripCard } from "@/components/ui/TripCard";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import type { Trip, City } from "@/types";
import { useRouter } from "next/navigation";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

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

  const { setSearchParams, setSelectedTrip, setSearchResults, searchResults } =
    useBookingStore();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [cities, setCities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"price" | "departure">("departure");

  useEffect(() => {
    if (originId && destinationId && date) {
      setSearchParams({
        origin: originId,
        destination: destinationId,
        date,
      });
    }
  }, [originId, destinationId, date, setSearchParams]);

  const fetchCities = useCallback(async () => {
    const { data } = await supabase
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
    if (!originId || !destinationId || !date) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select(
        `*, agency:agencies(id, name, slug), bus:buses(id, model, plate_number, capacity, seat_layout), origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name)`
      )
      .eq("origin_city_id", originId)
      .eq("destination_city_id", destinationId)
      .eq("departure_date", date)
      .eq("is_active", true)
      .neq("status", "cancelled")
      .order("departure_time");

    if (error) {
      console.error("Error fetching trips:", error);
    }
    if (data) {
      setTrips(data as unknown as Trip[]);
      setSearchResults(data as unknown as Trip[]);
    }
    setLoading(false);
  }, [originId, destinationId, date, setSearchResults]);

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
            New Search
          </button>
          <h1 className="text-2xl font-bold text-navy-800">
            {originName} to {destName}
          </h1>
          <p className="text-sm text-navy-500 mt-1">
            {date} - {trips.length} trip{trips.length !== 1 ? "s" : ""} found
          </p>
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
          <p className="text-sm text-navy-500 mb-6">
            No available trips for this route and date. Try a different date or
            route.
          </p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Search Again
          </Button>
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

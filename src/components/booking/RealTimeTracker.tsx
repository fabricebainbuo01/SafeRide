"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Bus, Navigation } from "lucide-react";

interface RealTimeTrackerProps {
  tripId: string;
  originName: string;
  destName: string;
}

interface Location {
  lat: number;
  lng: number;
  speed: number;
  recorded_at: string;
}

export function RealTimeTracker({ tripId, originName, destName }: RealTimeTrackerProps) {
  const [location, setLocation] = useState<Location | null>(null);
  const [status, setStatus] = useState<string>("scheduled");

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    const fetchLatestLocation = async () => {
      const { data, error } = await client
        .from("bus_locations")
        .select("latitude, longitude, speed, recorded_at")
        .eq("trip_id", tripId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLocation({
          lat: data.latitude,
          lng: data.longitude,
          speed: data.speed,
          recorded_at: data.recorded_at,
        });
      }
    };

    const fetchTripStatus = async () => {
      const { data } = await client
        .from("trips")
        .select("status")
        .eq("id", tripId)
        .maybeSingle();
      if (data) setStatus(data.status);
    };

    fetchLatestLocation();
    fetchTripStatus();

    const channel = client
      .channel(`trip-${tripId}-location-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bus_locations",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const row = payload.new as { latitude: number; longitude: number; speed: number; recorded_at: string };
          setLocation({
            lat: row.latitude,
            lng: row.longitude,
            speed: row.speed,
            recorded_at: row.recorded_at,
          });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [tripId]);

  if (status === "arrived") {
    return (
      <div className="bg-primary-50 border border-primary-200 p-4 text-center">
        <p className="text-sm font-medium text-primary-700">Bus has arrived at destination.</p>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="bg-red-50 border border-red-200 p-4 text-center">
        <p className="text-sm font-medium text-red-700">This trip has been cancelled.</p>
      </div>
    );
  }

  // Honest status mapping. Progress is a coarse hint based on status, not GPS.
  const progressByStatus: Record<string, number> = {
    scheduled: 0,
    boarding: 5,
    departed: 50,
  };
  const progress = progressByStatus[status] ?? 0;
  const lastSeen = location
    ? new Date(location.recorded_at).toLocaleTimeString("en-CM", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-navy-400 mb-1">
        <span>{originName}</span>
        <span>{destName}</span>
      </div>

      <div className="relative h-2 bg-navy-100 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-primary-700 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-navy-100 flex items-center justify-center">
          <Bus size={18} className="text-navy-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-800">
            {status === "departed"
              ? "Bus is in transit"
              : status === "boarding"
              ? "Boarding in progress"
              : "Scheduled"}
          </p>
          {location ? (
            <p className="text-xs text-navy-500">
              Last GPS ping {lastSeen} — speed {Math.round(location.speed)} km/h
            </p>
          ) : (
            <p className="text-xs text-navy-500">No GPS pings yet for this trip.</p>
          )}
        </div>
      </div>

      <div className="p-3 bg-navy-50 border border-navy-100 flex items-center gap-2">
        <Navigation size={14} className="text-action-700 shrink-0" />
        <p className="text-xs text-navy-600">
          Status reflects what the agency has reported. A live map view will be enabled here once the agency starts streaming GPS data for this trip.
        </p>
      </div>
    </div>
  );
}

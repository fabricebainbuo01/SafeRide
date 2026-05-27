"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { toast, toastError } from "@/lib/toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { formatTime, formatCurrency, formatDate, localDateISOString } from "@/lib/utils";
import type { Bus, City, Trip } from "@/types";
import { Plus } from "lucide-react";

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  scheduled: "info",
  boarding: "warning",
  departed: "default",
  arrived: "success",
  cancelled: "danger",
};

export default function SchedulesPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  /** Set when profile row exists but agency_id is null (not the same as “no trips yet”). */
  const [missingAgencyLink, setMissingAgencyLink] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [busId, setBusId] = useState("");
  const [originCityId, setOriginCityId] = useState("");
  const [destinationCityId, setDestinationCityId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [price, setPrice] = useState("");

  const fetchData = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setMissingAgencyLink(false);
      setLoading(false);
      return;
    }
    const { data: { user: authUser } } = await client.auth.getUser();
    if (!authUser) { router.push("/auth/login"); return; }

    const { data: userData } = await client
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!userData?.agency_id) {
      setMissingAgencyLink(true);
      setTrips([]);
      setBuses([]);
      setCities([]);
      setLoading(false);
      return;
    }
    setMissingAgencyLink(false);
    const agencyId = userData.agency_id;

    const [tripsRes, busesRes, citiesRes] = await Promise.all([
      client
        .from("trips")
        .select(`*, bus:buses(id, model, plate_number), origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name)`)
        .eq("agency_id", agencyId)
        .order("departure_date", { ascending: false }),
      client.from("buses").select("*").eq("agency_id", agencyId).eq("is_active", true),
      client.from("cities").select("*").eq("is_active", true).order("name"),
    ]);

    if (tripsRes.error) toastError(tripsRes.error, "Couldn't load trips");
    if (busesRes.error) toastError(busesRes.error, "Couldn't load buses");
    if (citiesRes.error) toastError(citiesRes.error, "Couldn't load cities");

    if (tripsRes.data) setTrips(tripsRes.data as unknown as Trip[]);
    if (busesRes.data) setBuses(busesRes.data as unknown as Bus[]);
    if (citiesRes.data) setCities(citiesRes.data as unknown as City[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTrip = async () => {
    const client = getSupabase();
    if (!client) return;
    const { data: { user: authUser } } = await client.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await client
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!userData?.agency_id) {
      toast.error("Your account is not linked to an agency");
      return;
    }

    if (originCityId === destinationCityId) {
      toast.error("Origin and destination must differ");
      return;
    }

    const { error } = await client.from("trips").insert({
      agency_id: userData.agency_id,
      bus_id: busId,
      origin_city_id: originCityId,
      destination_city_id: destinationCityId,
      departure_date: departureDate,
      departure_time: departureTime,
      estimated_arrival_time: estimatedArrival || null,
      price: parseInt(price),
    });

    if (error) {
      toastError(error, "Could not create trip");
      return;
    }
    toast.success("Trip created");

    setShowForm(false);
    setBusId("");
    setOriginCityId("");
    setDestinationCityId("");
    setDepartureDate("");
    setDepartureTime("");
    setEstimatedArrival("");
    setPrice("");
    fetchData();
  };

  const handleUpdateStatus = async (tripId: string, status: string) => {
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.from("trips").update({ status }).eq("id", tripId);
    if (error) {
      toastError(error, "Could not update status");
      return;
    }
    toast.success(`Status: ${status}`);
    fetchData();
  };

  /** Hard-delete so the trip no longer appears in search or admin lists (FK cascades remove dependent booking shells). */
  const handleDeleteTrip = async (tripId: string) => {
    if (
      !window.confirm(
        "Remove this trip from SafeRide? It will no longer appear for passengers or in schedules. Related booking rows tied only to this trip will be removed."
      )
    ) {
      return;
    }
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.from("trips").delete().eq("id", tripId);
    if (error) {
      toastError(error, "Could not remove trip");
      return;
    }
    toast.success("Trip removed from the platform");
    fetchData();
  };

  const busOptions = buses.map((b) => ({
    value: b.id,
    label: `${b.plate_number} - ${b.model} (${b.capacity} seats)`,
  }));

  const cityOptions = cities.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const today = localDateISOString();

  if (loading) {
    return (
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <LoadingSkeleton className="h-8 w-48 mb-6" />
          <LoadingSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-navy-800">Schedule Management</h1>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-2" />
            New Trip
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Trip</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select
                label="Bus"
                options={busOptions}
                placeholder="Select bus"
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                id="bus"
              />
              <Select
                label="Origin City"
                options={cityOptions}
                placeholder="Select origin"
                value={originCityId}
                onChange={(e) => setOriginCityId(e.target.value)}
                id="origin"
              />
              <Select
                label="Destination City"
                options={cityOptions}
                placeholder="Select destination"
                value={destinationCityId}
                onChange={(e) => setDestinationCityId(e.target.value)}
                id="destination"
              />
              <Input
                label="Departure Date"
                type="date"
                min={today}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                id="dep-date"
              />
              <Input
                label="Departure Time"
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                id="dep-time"
              />
              <Input
                label="Est. Arrival Time"
                type="time"
                value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
                id="arr-time"
              />
              <Input
                label="Price (XAF)"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                id="price"
                placeholder="e.g. 5000"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleCreateTrip}
                disabled={!busId || !originCityId || !destinationCityId || !departureDate || !departureTime || !price}
              >
                Create Trip
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {missingAgencyLink ? (
          <Card>
            <p className="text-center text-navy-700 text-sm font-medium mb-2">
              Your account is not linked to an agency yet.
            </p>
            <p className="text-center text-navy-500 text-xs">
              Schedules are scoped to your agency. After your application is approved, your profile should include{" "}
              <code className="text-navy-700">agency_id</code>. Contact support if you already manage an agency but still see this message.
            </p>
          </Card>
        ) : trips.length === 0 ? (
          <Card>
            <p className="text-center text-navy-500 text-sm mb-2">
              No trips scheduled for your agency yet.
            </p>
            <p className="text-center text-navy-400 text-xs">
              Run <code className="text-navy-600">supabase/seed_trips.sql</code> in the Supabase SQL editor to add sample schedules for every active agency, or create a trip with{" "}
              <strong>New Trip</strong>.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <Card key={trip.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-navy-800">
                      {trip.origin_city?.name} - {trip.destination_city?.name}
                    </h3>
                    <Badge variant={statusVariant[trip.status] || "default"}>
                      {trip.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-navy-500">
                    {formatDate(trip.departure_date)} at {formatTime(trip.departure_time)}
                    {trip.estimated_arrival_time && ` - Arr: ${formatTime(trip.estimated_arrival_time)}`}
                  </p>
                  <p className="text-xs text-navy-400 mt-1">
                    {trip.bus?.plate_number} | {trip.bus?.model} | {formatCurrency(trip.price, trip.currency)} | {trip.available_seats} seats left
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {trip.status === "scheduled" && (
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(trip.id, "boarding")}>
                      Start Boarding
                    </Button>
                  )}
                  {trip.status === "boarding" && (
                    <Button size="sm" onClick={() => handleUpdateStatus(trip.id, "departed")}>
                      Mark Departed
                    </Button>
                  )}
                  {trip.status === "departed" && (
                    <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(trip.id, "arrived")}>
                      Mark Arrived
                    </Button>
                  )}
                  {trip.status !== "arrived" && (
                    <Button size="sm" variant="danger" onClick={() => handleDeleteTrip(trip.id)}>
                      Remove trip
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

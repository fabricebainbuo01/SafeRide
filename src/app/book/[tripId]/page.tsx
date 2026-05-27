"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useBookingStore } from "@/store/booking-store";
import { SeatGrid } from "@/components/ui/SeatGrid";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatTime, formatDate } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";
import type { Trip, SeatLayout } from "@/types";
import { ArrowLeft, Clock, MapPin, Users } from "lucide-react";

interface PassengerEntry {
  name: string;
  phone: string;
}

export default function BookPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const {
    setSelectedTrip,
    selectedSeats,
    toggleSeat,
    occupiedSeats,
    setOccupiedSeats,
    seatLayout,
    setSeatLayout,
  } = useBookingStore();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isBooking, setIsBooking] = useState(false);

  // First passenger is the lead/contact passenger; we apply their details to
  // every seat by default but each seat can be edited independently.
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [perSeatPassengers, setPerSeatPassengers] = useState<Record<number, PassengerEntry>>({});
  const [showPerSeat, setShowPerSeat] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setCheckingAuth(false);
      toast.error("Booking is unavailable", "Supabase is not configured.");
      return;
    }
    async function checkAuth() {
      const { data: { user } } = await client!.auth.getUser();
      if (!user) {
        router.push(`/auth/login?redirectTo=/book/${tripId}`);
      } else {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, [router, tripId]);

  const fetchTrip = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await client
      .from("trips")
      .select(
        `*, agency:agencies(id, name), bus:buses(id, model, plate_number, capacity, seat_layout), origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name)`
      )
      .eq("id", tripId)
      .single();

    if (error) {
      console.error("Error fetching trip:", error);
      toastError(error, "Couldn't load this trip");
    }
    if (data) {
      const tripData = data as unknown as Trip;
      setTrip(tripData);
      setSelectedTrip(tripData);
      if (tripData.bus?.seat_layout) {
        setSeatLayout(tripData.bus.seat_layout as SeatLayout);
      }
    }
    setLoading(false);
  }, [tripId, setSelectedTrip, setSeatLayout]);

  const fetchOccupiedSeats = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    const { data } = await client
      .from("bookings")
      .select("seat_number")
      .eq("trip_id", tripId)
      .neq("status", "cancelled");

    if (data) {
      setOccupiedSeats(data.map((b: { seat_number: number }) => b.seat_number));
    }
  }, [tripId, setOccupiedSeats]);

  useEffect(() => {
    fetchTrip();
    fetchOccupiedSeats();
  }, [fetchTrip, fetchOccupiedSeats]);

  // Real-time subscription for seat updates — null-safe.
  // Channel name carries a timestamp so React 18 StrictMode's double-mount
  // (and any rapid re-renders) can't collide with a still-tearing-down
  // channel of the same logical name.
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    const channel = client
      .channel(`trip-${tripId}-seats-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          fetchOccupiedSeats();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [tripId, fetchOccupiedSeats]);

  const handleBooking = async () => {
    const client = getSupabase();
    if (!client || !trip) return;

    if (selectedSeats.length === 0) {
      toast.error("No seats selected", "Pick at least one seat from the map.");
      return;
    }
    if (!leadName.trim() || !leadPhone.trim()) {
      toast.error("Lead passenger details required");
      return;
    }

    setIsBooking(true);
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const totalAmount = trip.price * selectedSeats.length;

      // 1) Create the booking group (one row per checkout).
      const { data: groupData, error: groupErr } = await client
        .from("booking_groups")
        .insert({
          user_id: user.id,
          trip_id: trip.id,
          group_code: generateGroupCode(),
          total_amount: totalAmount,
          currency: trip.currency,
          payment_status: "pending",
        })
        .select()
        .single();

      if (groupErr || !groupData) {
        throw groupErr ?? new Error("Could not create booking group");
      }

      // 2) Create one booking per seat, attached to the group.
      const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
      const bookings = sortedSeats.map((seat) => {
        const override = perSeatPassengers[seat];
        return {
          group_id: groupData.id,
          trip_id: trip.id,
          user_id: user.id,
          seat_number: seat,
          passenger_name: override?.name?.trim() || leadName.trim(),
          passenger_phone: override?.phone?.trim() || leadPhone.trim(),
          amount: trip.price,
          currency: trip.currency,
          status: "confirmed" as const,
          payment_status: "pending" as const,
        };
      });

      const { error: insertErr } = await client.from("bookings").insert(bookings);
      if (insertErr) {
        await client.from("booking_groups").delete().eq("id", groupData.id);
        if (insertErr.code === "23505" || /duplicate key/i.test(insertErr.message ?? "")) {
          toast.error(
            "Seat no longer available",
            "Someone booked those seats — refresh and choose others."
          );
        } else {
          toastError(insertErr, "Booking failed");
        }
        return;
      }

      toast.success(
        sortedSeats.length === 1 ? "Seat booked" : `${sortedSeats.length} seats booked`,
        "We'll show you the booking summary next."
      );
      router.push(`/booking/${groupData.group_code}`);
    } catch (err) {
      console.error("Booking error:", err);
      toastError(err, "Booking failed");
    } finally {
      setIsBooking(false);
    }
  };

  if (checkingAuth || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse-slow space-y-4">
          <div className="h-8 w-64 bg-navy-100" />
          <div className="h-64 bg-navy-100" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-navy-700">Trip not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/search")}>
          Back to Search
        </Button>
      </div>
    );
  }

  const totalPrice = trip.price * selectedSeats.length;
  const sortedSeats = [...selectedSeats].sort((a, b) => a - b);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-800 mb-4"
      >
        <ArrowLeft size={14} />
        Back to Results
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl font-bold text-navy-800">
                  {trip.origin_city?.name} to {trip.destination_city?.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-500 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {trip.agency?.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {formatTime(trip.departure_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {trip.available_seats} seats left
                  </span>
                </div>
              </div>
              <Badge
                variant={
                  trip.status === "boarding"
                    ? "warning"
                    : trip.status === "scheduled"
                    ? "info"
                    : "default"
                }
              >
                {trip.status}
              </Badge>
            </div>
            <p className="text-sm text-navy-400">
              {formatDate(trip.departure_date)} | {trip.bus?.model} | {trip.bus?.plate_number}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Your Seats</CardTitle>
            </CardHeader>
            {seatLayout ? (
              <SeatGrid
                layout={seatLayout}
                occupiedSeats={occupiedSeats}
                selectedSeats={selectedSeats}
                onSeatClick={toggleSeat}
              />
            ) : (
              <p className="text-sm text-navy-500">
                Seat layout not available for this bus.
              </p>
            )}
          </Card>

          {sortedSeats.length > 1 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <CardTitle>Per-seat passenger details</CardTitle>
                <button
                  type="button"
                  onClick={() => setShowPerSeat((v) => !v)}
                  className="text-xs text-primary-700 hover:underline"
                >
                  {showPerSeat ? "Use lead passenger for all seats" : "Customise each seat"}
                </button>
              </div>
              {showPerSeat ? (
                <div className="space-y-4">
                  {sortedSeats.map((seat) => (
                    <div key={seat} className="grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr] gap-3 items-end">
                      <div className="text-sm font-semibold text-navy-700">Seat {seat}</div>
                      <Input
                        label="Passenger name"
                        placeholder={leadName || "Full name"}
                        value={perSeatPassengers[seat]?.name ?? ""}
                        onChange={(e) =>
                          setPerSeatPassengers((prev) => ({
                            ...prev,
                            [seat]: { ...(prev[seat] ?? { name: "", phone: "" }), name: e.target.value },
                          }))
                        }
                      />
                      <Input
                        label="Phone"
                        placeholder={leadPhone || "+237 6XX XXX XXX"}
                        value={perSeatPassengers[seat]?.phone ?? ""}
                        onChange={(e) =>
                          setPerSeatPassengers((prev) => ({
                            ...prev,
                            [seat]: { ...(prev[seat] ?? { name: "", phone: "" }), phone: e.target.value },
                          }))
                        }
                        type="tel"
                      />
                    </div>
                  ))}
                  <p className="text-xs text-navy-400">
                    Empty fields fall back to the lead passenger&apos;s details.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-navy-500">
                  All {sortedSeats.length} seats will be booked under{" "}
                  <span className="font-medium text-navy-700">{leadName || "the lead passenger"}</span>.
                </p>
              )}
            </Card>
          )}
        </div>

        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>

            <div className="space-y-4">
              <div className="text-sm">
                <p className="text-navy-500">Route</p>
                <p className="font-medium text-navy-800">
                  {trip.origin_city?.name} - {trip.destination_city?.name}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-navy-500">Date</p>
                <p className="font-medium text-navy-800">{formatDate(trip.departure_date)}</p>
              </div>
              <div className="text-sm">
                <p className="text-navy-500">Departure</p>
                <p className="font-medium text-navy-800">{formatTime(trip.departure_time)}</p>
              </div>
              <div className="text-sm">
                <p className="text-navy-500">Seats</p>
                <p className="font-medium text-navy-800">
                  {sortedSeats.length > 0 ? sortedSeats.join(", ") : "None selected"}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-navy-500">Price per seat</p>
                <p className="font-medium text-navy-800">
                  {formatCurrency(trip.price, trip.currency)}
                </p>
              </div>

              <div className="border-t border-navy-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-navy-800">Total</span>
                  <span className="text-xl font-bold text-navy-800">
                    {formatCurrency(totalPrice, trip.currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Input
                  label="Lead passenger name"
                  placeholder="Full name"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  id="passenger-name"
                />
                <Input
                  label="Phone Number"
                  placeholder="+237 6XX XXX XXX"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  id="passenger-phone"
                  type="tel"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleBooking}
                loading={isBooking}
                disabled={selectedSeats.length === 0 || !leadName || !leadPhone}
              >
                Confirm Booking
              </Button>

              <p className="text-[11px] text-navy-400 text-center">
                Payment is collected after a SafeRide agent confirms availability. Online payment (MTN MoMo, Orange Money, PayPal) coming soon.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function generateGroupCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

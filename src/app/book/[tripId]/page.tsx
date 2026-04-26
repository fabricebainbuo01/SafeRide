"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useBookingStore } from "@/store/booking-store";
import { SeatGrid } from "@/components/ui/SeatGrid";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatTime, formatDate } from "@/lib/utils";
import type { Trip, SeatLayout } from "@/types";
import { ArrowLeft, Clock, MapPin, Users } from "lucide-react";

export default function BookPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const {
    selectedTrip,
    setSelectedTrip,
    selectedSeats,
    toggleSeat,
    clearSeats,
    occupiedSeats,
    setOccupiedSeats,
    seatLayout,
    setSeatLayout,
    isBooking,
    setIsBooking,
  } = useBookingStore();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select(
        `*, agency:agencies(id, name), bus:buses(id, model, plate_number, capacity, seat_layout), origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name)`
      )
      .eq("id", tripId)
      .single();

    if (error) {
      console.error("Error fetching trip:", error);
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
    const { data } = await supabase
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

  // Real-time subscription for seat updates
  useEffect(() => {
    const channel = supabase
      .channel(`trip-${tripId}-seats`)
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
      supabase.removeChannel(channel);
    };
  }, [tripId, fetchOccupiedSeats]);

  const handleBooking = async () => {
    if (!trip || selectedSeats.length === 0 || !passengerName || !passengerPhone)
      return;

    setIsBooking(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const bookings = selectedSeats.map((seat) => ({
        trip_id: trip.id,
        user_id: user.id,
        seat_number: seat,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        amount: trip.price,
        currency: trip.currency,
        status: "confirmed",
        payment_status: "pending",
      }));

      const { data, error } = await supabase
        .from("bookings")
        .insert(bookings)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        router.push(`/ticket/${data[0].booking_code}`);
      }
    } catch (err) {
      console.error("Booking error:", err);
    } finally {
      setIsBooking(false);
    }
  };

  if (loading) {
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
        {/* Trip Info + Seat Selection */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl font-bold text-navy-800">
                  {trip.origin_city?.name} to {trip.destination_city?.name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-navy-500 mt-1">
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
              {formatDate(trip.departure_date)} | {trip.bus?.model} |{" "}
              {trip.bus?.plate_number}
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
        </div>

        {/* Booking Summary */}
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
                <p className="font-medium text-navy-800">
                  {formatDate(trip.departure_date)}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-navy-500">Departure</p>
                <p className="font-medium text-navy-800">
                  {formatTime(trip.departure_time)}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-navy-500">Seats</p>
                <p className="font-medium text-navy-800">
                  {selectedSeats.length > 0
                    ? selectedSeats.sort((a, b) => a - b).join(", ")
                    : "None selected"}
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
                  label="Passenger Name"
                  placeholder="Full name"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  id="passenger-name"
                />
                <Input
                  label="Phone Number"
                  placeholder="+237 6XX XXX XXX"
                  value={passengerPhone}
                  onChange={(e) => setPassengerPhone(e.target.value)}
                  id="passenger-phone"
                  type="tel"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleBooking}
                loading={isBooking}
                disabled={
                  selectedSeats.length === 0 ||
                  !passengerName ||
                  !passengerPhone
                }
              >
                Confirm Booking
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

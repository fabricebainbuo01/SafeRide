"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Booking } from "@/types";
import { Search, CheckCircle, X } from "lucide-react";

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  confirmed: "info",
  checked_in: "success",
  cancelled: "danger",
  no_show: "warning",
};

const paymentVariant: Record<string, "success" | "warning" | "danger"> = {
  paid: "success",
  pending: "warning",
  refunded: "danger",
};

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [foundBooking, setFoundBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) { router.push("/auth/login"); return; }

    const { data: userData } = await supabase
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .single();

    if (!userData?.agency_id) return;

    const { data: agencyTrips } = await supabase
      .from("trips")
      .select("id")
      .eq("agency_id", userData.agency_id);

    if (!agencyTrips || agencyTrips.length === 0) {
      setLoading(false);
      return;
    }

    const tripIds = agencyTrips.map((t: { id: string }) => t.id);

    const { data } = await supabase
      .from("bookings")
      .select(
        `*, trip:trips(id, departure_date, departure_time, status, origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name))`
      )
      .in("trip_id", tripIds)
      .order("created_at", { ascending: false });

    if (data) setBookings(data as unknown as Booking[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCheckIn = async (bookingId: string) => {
    await supabase
      .from("bookings")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("id", bookingId);
    fetchBookings();
    if (foundBooking?.id === bookingId) {
      setFoundBooking(null);
      setSearchCode("");
    }
  };

  const handleCancel = async (bookingId: string) => {
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);
    fetchBookings();
  };

  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    const { data } = await supabase
      .from("bookings")
      .select(
        `*, trip:trips(id, departure_date, departure_time, status, origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name))`
      )
      .eq("booking_code", searchCode.trim().toUpperCase())
      .single();

    if (data) {
      setFoundBooking(data as unknown as Booking);
    } else {
      setFoundBooking(null);
    }
  };

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
        <h1 className="text-2xl font-bold text-navy-800 mb-6">
          Bookings & Check-In
        </h1>

        {/* Check-In Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Check-In</CardTitle>
          </CardHeader>
          <div className="flex gap-3">
            <Input
              placeholder="Enter booking code"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              id="search-code"
              className="max-w-xs"
            />
            <Button onClick={handleSearch} disabled={!searchCode.trim()}>
              <Search size={16} className="mr-2" />
              Look Up
            </Button>
          </div>

          {foundBooking && (
            <div className="mt-4 p-4 border border-navy-200 bg-navy-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-mono font-bold text-navy-800 text-lg">
                    {foundBooking.booking_code}
                  </p>
                  <p className="text-sm text-navy-600">
                    {foundBooking.passenger_name} | Seat {foundBooking.seat_number}
                  </p>
                  {foundBooking.trip && (
                    <p className="text-xs text-navy-400 mt-1">
                      {foundBooking.trip.origin_city?.name} - {foundBooking.trip.destination_city?.name} | {formatDate(foundBooking.trip.departure_date)} at {formatTime(foundBooking.trip.departure_time)}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant={statusVariant[foundBooking.status]}>
                      {foundBooking.status.replace("_", " ")}
                    </Badge>
                    <Badge variant={paymentVariant[foundBooking.payment_status]}>
                      {foundBooking.payment_status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {foundBooking.status === "confirmed" && (
                    <Button size="sm" onClick={() => handleCheckIn(foundBooking.id)}>
                      <CheckCircle size={14} className="mr-1" />
                      Check In
                    </Button>
                  )}
                  {foundBooking.status === "confirmed" && (
                    <Button size="sm" variant="danger" onClick={() => handleCancel(foundBooking.id)}>
                      <X size={14} className="mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {searchCode && foundBooking === null && (
            <p className="mt-3 text-sm text-red-600">No booking found with that code.</p>
          )}
        </Card>

        {/* All Bookings */}
        <h2 className="text-lg font-semibold text-navy-800 mb-4">
          All Bookings ({bookings.length})
        </h2>

        {bookings.length === 0 ? (
          <Card>
            <p className="text-center text-navy-500 text-sm">
              No bookings yet for your agency.
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200">
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Passenger</th>
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Route</th>
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Seat</th>
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Payment</th>
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-navy-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-navy-100 hover:bg-navy-50">
                    <td className="py-3 px-4 font-mono font-medium text-navy-800">
                      {booking.booking_code}
                    </td>
                    <td className="py-3 px-4 text-navy-700">
                      {booking.passenger_name}
                    </td>
                    <td className="py-3 px-4 text-navy-600">
                      {booking.trip?.origin_city?.name} - {booking.trip?.destination_city?.name}
                    </td>
                    <td className="py-3 px-4 text-navy-700">{booking.seat_number}</td>
                    <td className="py-3 px-4">
                      <Badge variant={statusVariant[booking.status]}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={paymentVariant[booking.payment_status]}>
                        {booking.payment_status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-navy-800">
                      {formatCurrency(booking.amount, booking.currency)}
                    </td>
                    <td className="py-3 px-4">
                      {booking.status === "confirmed" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleCheckIn(booking.id)}>
                            <CheckCircle size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleCancel(booking.id)}>
                            <X size={14} className="text-red-600" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

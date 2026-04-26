"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Booking } from "@/types";
import { Printer, Download, ArrowLeft } from "lucide-react";

export default function TicketPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBooking = useCallback(async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `*, trip:trips(id, departure_date, departure_time, estimated_arrival_time, price, currency, status, origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name), agency:agencies(id, name), bus:buses(id, model, plate_number))`
      )
      .eq("booking_code", code)
      .single();

    if (error) {
      console.error("Error fetching booking:", error);
    }
    if (data) {
      setBooking(data as unknown as Booking);
    }
    setLoading(false);
  }, [code]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="animate-pulse-slow space-y-4">
          <div className="h-8 w-48 bg-navy-100" />
          <div className="h-64 bg-navy-100" />
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-navy-700">
          Booking not found
        </h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
          Go Home
        </Button>
      </div>
    );
  }

  const trip = booking.trip;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-800 mb-4"
      >
        <ArrowLeft size={14} />
        My Bookings
      </button>

      <Card className="relative overflow-hidden print:shadow-none print:border-none">
        {/* Ticket Header */}
        <div className="bg-navy-800 text-white p-6 -m-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">SafeRide</h1>
              <p className="text-navy-300 text-xs mt-0.5">
                Inter-Urban Bus Ticket
              </p>
            </div>
            <Badge
              variant={
                booking.status === "confirmed"
                  ? "info"
                  : booking.status === "checked_in"
                  ? "success"
                  : booking.status === "cancelled"
                  ? "danger"
                  : "warning"
              }
            >
              {booking.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Ticket Body */}
        <div className="space-y-5">
          {/* Booking Code - Prominent */}
          <div className="text-center py-4 border border-dashed border-navy-300">
            <p className="text-xs text-navy-400 uppercase tracking-wider mb-1">
              Booking Code
            </p>
            <p className="text-3xl font-mono font-bold text-navy-800 tracking-widest">
              {booking.booking_code}
            </p>
          </div>

          {/* Route */}
          {trip && (
            <div className="flex items-center justify-between py-3">
              <div className="text-center">
                <p className="text-lg font-bold text-navy-800">
                  {trip.origin_city?.name || "N/A"}
                </p>
                <p className="text-xs text-navy-400">Departure</p>
              </div>
              <div className="flex-1 mx-4 flex items-center">
                <div className="h-px flex-1 bg-navy-300" />
                <div className="mx-2 w-2 h-2 bg-primary-700 rotate-45" />
                <div className="h-px flex-1 bg-navy-300" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-navy-800">
                  {trip.destination_city?.name || "N/A"}
                </p>
                <p className="text-xs text-navy-400">Arrival</p>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-navy-400 text-xs">Date</p>
              <p className="font-semibold text-navy-800">
                {trip ? formatDate(trip.departure_date) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-navy-400 text-xs">Departure Time</p>
              <p className="font-semibold text-navy-800">
                {trip ? formatTime(trip.departure_time) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-navy-400 text-xs">Seat Number</p>
              <p className="font-semibold text-navy-800">{booking.seat_number}</p>
            </div>
            <div>
              <p className="text-navy-400 text-xs">Agency</p>
              <p className="font-semibold text-navy-800">
                {trip?.agency?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-navy-400 text-xs">Passenger</p>
              <p className="font-semibold text-navy-800">
                {booking.passenger_name}
              </p>
            </div>
            <div>
              <p className="text-navy-400 text-xs">Phone</p>
              <p className="font-semibold text-navy-800">
                {booking.passenger_phone}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div className="border-t border-navy-200 pt-4 flex justify-between items-center">
            <span className="text-sm text-navy-500">Amount Paid</span>
            <span className="text-xl font-bold text-primary-700">
              {formatCurrency(booking.amount, booking.currency)}
            </span>
          </div>

          {/* Payment Status */}
          <div className="flex items-center gap-2 text-xs text-navy-400">
            <span>Payment: </span>
            <Badge
              variant={
                booking.payment_status === "paid"
                  ? "success"
                  : booking.payment_status === "refunded"
                  ? "danger"
                  : "warning"
              }
            >
              {booking.payment_status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Ticket Footer */}
        <div className="border-t border-dashed border-navy-300 mt-6 pt-4 text-center">
          <p className="text-xs text-navy-400">
            Present this ticket with the booking code at the agency counter.
            Arrive 30 minutes before departure.
          </p>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 mt-6 print:hidden">
        <Button variant="outline" className="flex-1" onClick={handlePrint}>
          <Printer size={16} className="mr-2" />
          Print Ticket
        </Button>
        <Button variant="secondary" className="flex-1">
          <Download size={16} className="mr-2" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}

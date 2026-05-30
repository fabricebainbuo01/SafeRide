"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { saveTicketPdf } from "@/lib/ticket-pdf";
import { logLead, ticketScanUrl } from "@/lib/leads";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { toastError } from "@/lib/toast";
import type { Booking } from "@/types";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { QRCode } from "react-qr-code";
import { RealTimeTracker } from "@/components/booking/RealTimeTracker";
import { SafeRideLogo } from "@/components/ui/SafeRideLogo";

export default function TicketPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchBooking = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    const { data, error } = await client
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

  /**
   * Counter staff scans the QR code on a printed ticket — the QR encodes a
   * URL with `?qr=1`, so we can distinguish that flow from the passenger
   * loading their own ticket. Read directly from `window.location.search`
   * to avoid forcing a Suspense boundary just for an analytic event.
   */
  useEffect(() => {
    if (!booking) return;
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("qr") !== "1") return;
    logLead({
      kind: "qr_scan",
      trip_id: booking.trip_id,
      agency_id: booking.trip?.agency?.id ?? booking.trip?.agency_id ?? null,
      user_id: booking.user_id ?? null,
      metadata: { booking_code: booking.booking_code },
      dedupeKey: `scan:${booking.booking_code}`,
    });
  }, [booking]);

  const handlePrint = () => {
    window.print();
    if (booking) {
      logLead({
        kind: "ticket_print",
        trip_id: booking.trip_id,
        agency_id: booking.trip?.agency?.id ?? booking.trip?.agency_id ?? null,
        user_id: booking.user_id ?? null,
        metadata: { booking_code: booking.booking_code },
        dedupeKey: booking.booking_code,
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (!booking) return;
    setPdfLoading(true);
    try {
      await saveTicketPdf(booking, code);
      logLead({
        kind: "ticket_download",
        trip_id: booking.trip_id,
        agency_id: booking.trip?.agency?.id ?? booking.trip?.agency_id ?? null,
        user_id: booking.user_id ?? null,
        metadata: { booking_code: booking.booking_code },
        dedupeKey: booking.booking_code,
      });
    } catch (err) {
      toastError(err, "Couldn't generate PDF");
    } finally {
      setPdfLoading(false);
    }
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
  const isLive = trip?.status === "boarding" || trip?.status === "departed";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-800 mb-4 print:hidden"
      >
        <ArrowLeft size={14} />
        My Bookings
      </button>

      {/* Ticket — mirrors the downloadable PDF layout */}
      <article className="bg-white border border-navy-200 print:border-none">
        {/* Navy header bar */}
        <header className="bg-navy-800 text-white px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <SafeRideLogo
              size="md"
              href={null}
              className="rounded bg-white px-2 py-1"
              imageClassName="!h-9"
            />
            <p className="text-[11px] text-navy-300 mt-2">
              Inter-Urban Bus Ticket
            </p>
          </div>
          <span className="text-xs font-bold uppercase tracking-wide">
            {booking.status.replace("_", " ")}
          </span>
        </header>

        <div className="px-6 sm:px-8 py-8 space-y-6">
          {/* Booking code */}
          <div className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-navy-400">
              Booking Code
            </p>
            <p className="mt-1 font-mono font-bold text-2xl sm:text-3xl text-navy-800 tracking-wider">
              {booking.booking_code}
            </p>
          </div>

          {/* QR code — encodes a /ticket/[code]?qr=1 URL so counter scans
              get logged as `qr_scan` leads on the BI dashboard. */}
          <div className="flex justify-center">
            <QRCode
              value={ticketScanUrl(booking.booking_code)}
              size={192}
              level="M"
              fgColor="#0f172a"
              bgColor="#ffffff"
            />
          </div>

          <p className="text-center text-xs text-navy-400">
            Scan or present booking code at the counter
          </p>

          {/* Route */}
          {trip && (
            <div className="space-y-1">
              <p className="text-sm font-bold text-navy-800">
                Departure: {trip.origin_city?.name ?? "—"}
              </p>
              <p className="text-sm font-bold text-navy-800">
                Arrival: {trip.destination_city?.name ?? "—"}
              </p>
            </div>
          )}

          {/* Two-column field grid (matches PDF rows) */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Field
              label="Date"
              value={trip ? formatDate(trip.departure_date) : "N/A"}
            />
            <Field
              label="Departure time"
              value={trip ? formatTime(trip.departure_time) : "N/A"}
            />
            <Field label="Seat" value={String(booking.seat_number)} />
            <Field label="Agency" value={trip?.agency?.name ?? "N/A"} />
            <Field label="Passenger" value={booking.passenger_name} />
            <Field label="Phone" value={booking.passenger_phone} />
          </div>

          <hr className="border-navy-200" />

          {/* Amount */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-navy-500">Amount</span>
            <span className="text-xl font-bold text-primary-700">
              {formatCurrency(booking.amount, booking.currency)}
            </span>
          </div>

          {/* Payment status — inline, matching the PDF "Payment: STATUS" line */}
          <div className="text-sm">
            <span className="text-navy-500">Payment: </span>
            <span className="font-bold text-navy-800">
              {booking.payment_status.toUpperCase()}
            </span>
          </div>

          {/* Live tracker is screen-only; not part of the PDF */}
          {isLive && trip && (
            <div className="p-3 bg-navy-50 border border-navy-200 print:hidden">
              <RealTimeTracker
                tripId={trip.id}
                originName={trip.origin_city?.name || "Origin"}
                destName={trip.destination_city?.name || "Destination"}
              />
            </div>
          )}

          {/* Footer copy mirrors the PDF */}
          <div className="border-t border-navy-200 pt-4 text-center">
            <p className="text-xs text-navy-400">
              Present this ticket with the booking code at the agency counter.
              Arrive 30 minutes before departure.
            </p>
          </div>
        </div>
      </article>

      <div className="flex gap-3 mt-6 print:hidden">
        <Button variant="outline" className="flex-1" onClick={handlePrint}>
          <Printer size={16} className="mr-2" />
          Print Ticket
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          loading={pdfLoading}
          onClick={() => void handleDownloadPdf()}
        >
          <Download size={16} className="mr-2" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-navy-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-navy-800 break-words">
        {value}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCode } from "react-qr-code";
import { Download, Eye } from "lucide-react";
import type { Booking } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatTime } from "@/lib/utils";
import { saveTicketPdf } from "@/lib/ticket-pdf";
import { toast, toastError } from "@/lib/toast";
import { logLead, ticketScanUrl } from "@/lib/leads";
import { RealTimeTracker } from "@/components/booking/RealTimeTracker";

const statusVariant: Record<
  string,
  "success" | "warning" | "danger" | "info" | "default"
> = {
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

export function TicketCard({ booking }: { booking: Booking }) {
  const isLive =
    booking.trip?.status === "boarding" || booking.trip?.status === "departed";
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await saveTicketPdf(booking, booking.booking_code);
      logLead({
        kind: "ticket_download",
        trip_id: booking.trip_id,
        agency_id: booking.trip?.agency?.id ?? booking.trip?.agency_id ?? null,
        user_id: booking.user_id,
        metadata: { booking_code: booking.booking_code },
        dedupeKey: booking.booking_code,
      });
      toast.success("Ticket downloaded");
    } catch (err) {
      toastError(err, "Couldn't download ticket");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card hover className="relative overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Top row: status badges + compact QR */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant[booking.status]}>
              {booking.status.replace("_", " ")}
            </Badge>
            <Badge variant={paymentVariant[booking.payment_status]}>
              {booking.payment_status}
            </Badge>
          </div>
          <div
            className="shrink-0 p-1.5 bg-white border border-navy-200"
            aria-label={`QR code for booking ${booking.booking_code}`}
          >
            <QRCode
              value={ticketScanUrl(booking.booking_code)}
              size={64}
              level="M"
              fgColor="#0f172a"
              bgColor="#ffffff"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-navy-400 text-xs">Booking Code</p>
            <p className="font-mono font-bold text-navy-800">
              {booking.booking_code}
            </p>
          </div>
          <div>
            <p className="text-navy-400 text-xs">Seat</p>
            <p className="font-semibold text-navy-800">{booking.seat_number}</p>
          </div>
          {booking.trip && (
            <>
              <div className="col-span-2">
                <p className="text-navy-400 text-xs">Route</p>
                <p className="font-semibold text-navy-800">
                  {booking.trip.origin_city?.name} -{" "}
                  {booking.trip.destination_city?.name}
                </p>
              </div>
              <div>
                <p className="text-navy-400 text-xs">Date</p>
                <p className="font-semibold text-navy-800">
                  {formatDate(booking.trip.departure_date)}
                </p>
              </div>
              <div>
                <p className="text-navy-400 text-xs">Departure</p>
                <p className="font-semibold text-navy-800">
                  {formatTime(booking.trip.departure_time)}
                </p>
              </div>
            </>
          )}
        </div>

        {isLive && booking.trip && (
          <div className="mt-2 p-3 bg-navy-50 border border-navy-200">
            <RealTimeTracker
              tripId={booking.trip.id}
              originName={booking.trip.origin_city?.name || "Origin"}
              destName={booking.trip.destination_city?.name || "Destination"}
            />
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-navy-100">
          <div className="min-w-0">
            <p className="text-[10px] text-navy-400 uppercase tracking-wider">
              Passenger
            </p>
            <p className="text-sm font-medium text-navy-700 truncate">
              {booking.passenger_name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            aria-label="Download ticket as PDF"
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-navy-700 border border-navy-300 hover:bg-navy-50 active-scale transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {downloading ? "…" : "DOWNLOAD"}
          </button>
          <Link
            href={`/ticket/${booking.booking_code}`}
            aria-label="View ticket details"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary-700 hover:bg-primary-800 active-scale transition-colors"
          >
            <Eye size={14} />
            VIEW
          </Link>
        </div>
      </div>
    </Card>
  );
}

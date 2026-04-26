import type { Booking } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";

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

export function TicketCard({ booking }: { booking: Booking }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-navy-50 flex items-center justify-center">
        <span className="text-navy-300 text-4xl font-bold">
          {booking.booking_code.slice(0, 2)}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[booking.status]}>
            {booking.status.replace("_", " ")}
          </Badge>
          <Badge variant={paymentVariant[booking.payment_status]}>
            {booking.payment_status}
          </Badge>
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
              <div>
                <p className="text-navy-400 text-xs">Route</p>
                <p className="font-semibold text-navy-800">
                  {booking.trip.origin_city?.name} - {booking.trip.destination_city?.name}
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
              <div>
                <p className="text-navy-400 text-xs">Amount</p>
                <p className="font-semibold text-navy-800">
                  {formatCurrency(booking.amount, booking.currency)}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-navy-100">
          <p className="text-xs text-navy-400">
            Passenger: {booking.passenger_name}
          </p>
          <Link
            href={`/ticket/${booking.booking_code}`}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800"
          >
            <Download size={12} />
            View Ticket
          </Link>
        </div>
      </div>
    </Card>
  );
}

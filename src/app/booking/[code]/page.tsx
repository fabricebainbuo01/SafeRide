"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";
import type { BookingGroup, Booking, Trip } from "@/types";
import { ArrowLeft, Printer, MessageCircle, Ticket } from "lucide-react";
import { logLead } from "@/lib/leads";
import { SafeRideLogo } from "@/components/ui/SafeRideLogo";

const SAFERIDE_WHATSAPP_NUMBER = "237683073601";

export default function BookingGroupPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [group, setGroup] = useState<BookingGroup | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const fetchGroup = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }

    const { data: groupData, error: groupErr } = await client
      .from("booking_groups")
      .select(
        `*, trip:trips(id, departure_date, departure_time, status, price, currency,
          origin_city:cities!trips_origin_city_id_fkey(id, name),
          destination_city:cities!trips_destination_city_id_fkey(id, name),
          agency:agencies(id, name),
          bus:buses(id, model, plate_number))`
      )
      .eq("group_code", code)
      .maybeSingle();

    if (groupErr) toastError(groupErr, "Couldn't load this booking group");

    if (groupData) {
      setGroup(groupData as unknown as BookingGroup);
      setTrip((groupData as unknown as BookingGroup).trip ?? null);

      const { data: rows, error: rowsErr } = await client
        .from("bookings")
        .select("*")
        .eq("group_id", groupData.id)
        .order("seat_number");

      if (rowsErr) toastError(rowsErr, "Couldn't load tickets");
      if (rows) setBookings(rows as unknown as Booking[]);
    }

    setLoading(false);
  }, [code]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  // Fire-and-forget: the WhatsApp link uses target="_blank" so this page
  // stays mounted, giving the insert plenty of time to complete in the
  // background without blocking the user.
  const logWhatsAppLead = useCallback(() => {
    if (!group || !trip) return;
    logLead({
      kind: "whatsapp_confirm",
      group_code: group.group_code,
      trip_id: trip.id,
      agency_id: trip.agency?.id ?? null,
      user_id: group.user_id,
      metadata: {
        seats: bookings.length,
        total_amount: group.total_amount,
        currency: group.currency,
      },
    });
  }, [group, trip, bookings.length]);

  const handlePrintGroup = useCallback(() => {
    window.print();
    if (!group || !trip) return;
    logLead({
      kind: "ticket_print",
      group_code: group.group_code,
      trip_id: trip.id,
      agency_id: trip.agency?.id ?? null,
      user_id: group.user_id,
      metadata: {
        seats: bookings.length,
        total_amount: group.total_amount,
      },
    });
  }, [group, trip, bookings.length]);

  const handleMockPayment = async () => {
    if (!group) return;
    const client = getSupabase();
    if (!client) {
      toast.error("Supabase not configured");
      return;
    }
    setPaying(true);
    try {
      const {
        data: { session },
      } = await client.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch("/api/payments/mock-confirm", {
        method: "POST",
        headers,
        body: JSON.stringify({ group_code: group.group_code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Payment failed");
      }
      toast.success("Payment confirmed", "Your tickets are now paid.");
      fetchGroup();
    } catch (err) {
      toastError(err, "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="animate-pulse-slow space-y-4">
          <div className="h-8 w-48 bg-navy-100" />
          <div className="h-64 bg-navy-100" />
        </div>
      </div>
    );
  }

  if (!group || !trip) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-navy-700">Booking not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
          My Bookings
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-800 mb-4 print:hidden"
      >
        <ArrowLeft size={14} />
        My Bookings
      </button>

      <Card>
        <div className="bg-navy-800 text-white p-6 -m-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <SafeRideLogo
                size="md"
                href={null}
                className="rounded bg-white px-2 py-1"
                imageClassName="!h-9"
              />
              <p className="text-navy-300 text-xs mt-2">
                Booking confirmation — {bookings.length}{" "}
                {bookings.length === 1 ? "seat" : "seats"}
              </p>
            </div>
            <Badge variant={group.payment_status === "paid" ? "success" : "warning"}>
              {group.payment_status.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="text-center py-4 border border-dashed border-navy-300 mb-5">
          <p className="text-xs text-navy-400 uppercase tracking-wider mb-1">Group Code</p>
          <p className="text-3xl font-mono font-bold text-navy-800 tracking-widest">
            {group.group_code}
          </p>
          <p className="text-xs text-navy-500 mt-1">Show this at the counter or use individual seat codes below.</p>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="text-center">
            <p className="text-lg font-bold text-navy-800">{trip.origin_city?.name}</p>
            <p className="text-xs text-navy-400">Departure</p>
          </div>
          <div className="flex-1 mx-4 flex items-center">
            <div className="h-px flex-1 bg-navy-300" />
            <div className="mx-2 w-2 h-2 bg-primary-700 rotate-45" />
            <div className="h-px flex-1 bg-navy-300" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-navy-800">{trip.destination_city?.name}</p>
            <p className="text-xs text-navy-400">Arrival</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm py-4 border-t border-b border-navy-100 my-4">
          <div>
            <p className="text-navy-400 text-xs">Date</p>
            <p className="font-semibold text-navy-800">{formatDate(trip.departure_date)}</p>
          </div>
          <div>
            <p className="text-navy-400 text-xs">Time</p>
            <p className="font-semibold text-navy-800">{formatTime(trip.departure_time)}</p>
          </div>
          <div>
            <p className="text-navy-400 text-xs">Agency</p>
            <p className="font-semibold text-navy-800">{trip.agency?.name}</p>
          </div>
        </div>

        <CardHeader>
          <CardTitle>Tickets</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-navy-100 -mx-6 mb-4">
          {bookings.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-6 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-navy-100 flex items-center justify-center text-navy-600">
                  <Ticket size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-800 truncate">
                    Seat {b.seat_number} · {b.passenger_name}
                  </p>
                  <p className="text-xs text-navy-500 truncate">{b.passenger_phone}</p>
                </div>
              </div>
              <Link
                href={`/ticket/${b.booking_code}`}
                className="text-xs font-mono font-semibold text-primary-700 hover:underline shrink-0"
              >
                {b.booking_code}
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-t border-navy-200 pt-4 flex justify-between items-center">
          <span className="text-sm text-navy-500">Total</span>
          <span className="text-xl font-bold text-primary-700">
            {formatCurrency(group.total_amount, group.currency)}
          </span>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 mt-6 print:hidden">
        {group.payment_status === "pending" && (
          <Button className="flex-1" onClick={handleMockPayment} loading={paying}>
            Pay {formatCurrency(group.total_amount, group.currency)} (mock)
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={handlePrintGroup}>
          <Printer size={16} className="mr-2" />
          Print
        </Button>
        <a
          href={`https://wa.me/${SAFERIDE_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I'd like to confirm booking ${group.group_code}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={logWhatsAppLead}
          className="inline-flex items-center justify-center flex-1 gap-2 px-4 py-2 text-sm font-medium text-primary-700 border border-primary-700 hover:bg-primary-50"
        >
          <MessageCircle size={16} />
          Confirm on WhatsApp
        </a>
      </div>
    </div>
  );
}

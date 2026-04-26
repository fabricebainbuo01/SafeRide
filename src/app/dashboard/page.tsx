"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TicketCard } from "@/components/ui/TicketCard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSkeleton, PageLoader } from "@/components/ui/Loading";
import type { Booking, User } from "@/types";
import {
  Ticket,
  Clock,
  CheckCircle,
  User as UserIcon,
  MapPin,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  const fetchUser = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      router.push("/auth/login");
      return;
    }
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();
    if (data) setUser(data as unknown as User);
  }, [router]);

  const fetchBookings = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data } = await supabase
      .from("bookings")
      .select(
        `*, trip:trips(id, departure_date, departure_time, estimated_arrival_time, price, currency, status, origin_city:cities!trips_origin_city_id_fkey(id, name), destination_city:cities!trips_destination_city_id_fkey(id, name), agency:agencies(id, name))`
      )
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false });

    if (data) setBookings(data as unknown as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
    fetchBookings();
  }, [fetchUser, fetchBookings]);

  // Real-time updates for bookings
  useEffect(() => {
    const {
      data: { user: authUser },
    } = { data: { user: null } };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        channel = supabase
          .channel(`user-${data.user.id}-bookings`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `user_id=eq.${data.user.id}`,
            },
            () => {
              fetchBookings();
            }
          )
          .subscribe();
      }
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  const activeBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "checked_in"
  );
  const historyBookings = bookings.filter(
    (b) => b.status === "cancelled" || b.status === "no_show"
  );

  const displayBookings =
    activeTab === "active" ? activeBookings : historyBookings;

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-navy-800 mb-6">
        Passenger Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-action-100 flex items-center justify-center">
            <Ticket size={18} className="text-action-700" />
          </div>
          <div>
            <p className="text-xs text-navy-400">Total Bookings</p>
            <p className="text-lg font-bold text-navy-800">
              {bookings.length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 flex items-center justify-center">
            <CheckCircle size={18} className="text-primary-700" />
          </div>
          <div>
            <p className="text-xs text-navy-400">Active Tickets</p>
            <p className="text-lg font-bold text-navy-800">
              {activeBookings.length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-navy-100 flex items-center justify-center">
            <Clock size={18} className="text-navy-600" />
          </div>
          <div>
            <p className="text-xs text-navy-400">Checked In</p>
            <p className="text-lg font-bold text-navy-800">
              {bookings.filter((b) => b.status === "checked_in").length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-navy-100 flex items-center justify-center">
            <MapPin size={18} className="text-navy-600" />
          </div>
          <div>
            <p className="text-xs text-navy-400">Routes Traveled</p>
            <p className="text-lg font-bold text-navy-800">
              {
                new Set(
                  bookings
                    .filter((b) => b.status === "checked_in")
                    .map((b) => b.trip_id)
                ).size
              }
            </p>
          </div>
        </Card>
      </div>

      {/* Profile Card */}
      {user && (
        <Card className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-navy-200 flex items-center justify-center">
              <UserIcon size={20} className="text-navy-500" />
            </div>
            <div>
              <h2 className="font-semibold text-navy-800">{user.full_name}</h2>
              <p className="text-sm text-navy-500">{user.phone}</p>
              {user.email && (
                <p className="text-sm text-navy-400">{user.email}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Bookings Tabs */}
      <div className="flex gap-1 mb-6 border-b border-navy-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "active"
              ? "text-primary-700 border-primary-700"
              : "text-navy-500 border-transparent hover:text-navy-700"
          }`}
          onClick={() => setActiveTab("active")}
        >
          Active Tickets ({activeBookings.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "text-primary-700 border-primary-700"
              : "text-navy-500 border-transparent hover:text-navy-700"
          }`}
          onClick={() => setActiveTab("history")}
        >
          History ({historyBookings.length})
        </button>
      </div>

      {/* Bookings List */}
      {displayBookings.length === 0 ? (
        <div className="text-center py-12">
          <Ticket size={32} className="mx-auto text-navy-300 mb-3" />
          <p className="text-navy-500 text-sm">
            {activeTab === "active"
              ? "No active tickets. Book a trip to get started."
              : "No booking history yet."}
          </p>
          {activeTab === "active" && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/search")}
            >
              Search Trips
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayBookings.map((booking) => (
            <TicketCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import type { Trip } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatTime } from "@/lib/utils";
import { Clock, MapPin, Users } from "lucide-react";

interface TripCardProps {
  trip: Trip;
  onSelect: (trip: Trip) => void;
}

const statusBadge: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  scheduled: "info",
  boarding: "warning",
  departed: "default",
  arrived: "success",
  cancelled: "danger",
};

export function TripCard({ trip, onSelect }: TripCardProps) {
  return (
    <Card hover className="hover:border-primary-700 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-navy-800">
              {trip.agency?.name || "Agency"}
            </h3>
            <Badge variant={statusBadge[trip.status] || "default"}>
              {trip.status}
            </Badge>
          </div>

          <div className="flex items-center gap-6 text-sm text-navy-600">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} />
              <span>
                {trip.origin_city?.name} - {trip.destination_city?.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>
                {formatTime(trip.departure_time)}
                {trip.estimated_arrival_time &&
                  ` - ${formatTime(trip.estimated_arrival_time)}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={14} />
              <span>{trip.available_seats} seats left</span>
            </div>
          </div>

          {trip.bus && (
            <p className="text-xs text-navy-400 mt-1">
              {trip.bus.model} - {trip.bus.plate_number}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="text-xl font-bold text-navy-800">
            {formatCurrency(trip.price, trip.currency)}
          </p>
          <Button
            onClick={() => onSelect(trip)}
            disabled={trip.available_seats === 0 || trip.status === "cancelled"}
            size="sm"
          >
            {trip.available_seats === 0 ? "Sold Out" : "Select Seats"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

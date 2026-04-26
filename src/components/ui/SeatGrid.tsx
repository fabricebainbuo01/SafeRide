"use client";

import type { SeatLayout } from "@/types";
import { cn } from "@/lib/utils";

interface SeatGridProps {
  layout: SeatLayout;
  occupiedSeats: number[];
  selectedSeats: number[];
  onSeatClick: (seat: number) => void;
  maxSelectable?: number;
}

export function SeatGrid({
  layout,
  occupiedSeats,
  selectedSeats,
  onSeatClick,
  maxSelectable = 4,
}: SeatGridProps) {
  const { rows, cols, aisleAfter, unavailable } = layout;
  const totalSeats = rows * cols;

  const isOccupied = (seat: number) => occupiedSeats.includes(seat);
  const isUnavailable = (seat: number) => unavailable.includes(seat);
  const isSelected = (seat: number) => selectedSeats.includes(seat);
  const canSelect = selectedSeats.length < maxSelectable;

  return (
    <div>
      <div className="flex items-center justify-center gap-6 mb-4 text-xs text-navy-500">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border border-navy-300 bg-white" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-primary-700" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-navy-300" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-navy-100 border border-navy-200" />
          <span>Unavailable</span>
        </div>
      </div>

      <div className="bg-navy-50 border border-navy-200 p-4 inline-block">
        <div className="flex justify-center mb-3">
          <div className="w-20 h-6 bg-navy-800 text-white text-xs flex items-center justify-center font-medium">
            FRONT
          </div>
        </div>

        <div className="space-y-2">
          {Array.from({ length: rows }, (_, rowIdx) => {
            const rowStart = rowIdx * cols + 1;
            return (
              <div key={rowIdx} className="flex items-center gap-1">
                {Array.from({ length: cols }, (_, colIdx) => {
                  const seatNum = rowStart + colIdx;
                  const isAisle = colIdx === aisleAfter;

                  if (isUnavailable(seatNum)) {
                    return (
                      <div key={seatNum} className="flex items-center">
                        <div
                          className="w-10 h-10 bg-navy-100 border border-navy-200 flex items-center justify-center text-xs text-navy-400"
                          title={`Seat ${seatNum} - Unavailable`}
                        >
                          {seatNum}
                        </div>
                        {isAisle && <div className="w-4" />}
                      </div>
                    );
                  }

                  if (isOccupied(seatNum)) {
                    return (
                      <div key={seatNum} className="flex items-center">
                        <div
                          className="w-10 h-10 bg-navy-300 flex items-center justify-center text-xs text-white cursor-not-allowed"
                          title={`Seat ${seatNum} - Occupied`}
                        >
                          {seatNum}
                        </div>
                        {isAisle && <div className="w-4" />}
                      </div>
                    );
                  }

                  const selected = isSelected(seatNum);
                  return (
                    <div key={seatNum} className="flex items-center">
                      <button
                        type="button"
                        className={cn(
                          "w-10 h-10 border flex items-center justify-center text-xs font-medium transition-colors",
                          selected
                            ? "bg-primary-700 text-white border-primary-700"
                            : "bg-white border-navy-300 text-navy-700 hover:border-primary-700 hover:text-primary-700",
                          !selected && !canSelect && "cursor-not-allowed opacity-50"
                        )}
                        onClick={() => onSeatClick(seatNum)}
                        disabled={!selected && !canSelect}
                        title={`Seat ${seatNum}`}
                      >
                        {seatNum}
                      </button>
                      {isAisle && <div className="w-4" />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {selectedSeats.length > 0 && (
        <p className="mt-3 text-sm text-navy-600">
          Selected: {selectedSeats.sort((a, b) => a - b).join(", ")}
        </p>
      )}
    </div>
  );
}

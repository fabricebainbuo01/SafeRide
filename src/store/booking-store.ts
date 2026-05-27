import { create } from "zustand";
import type { SearchParams, Trip, Booking, SeatLayout } from "@/types";

interface BookingState {
  searchParams: SearchParams;
  setSearchParams: (params: SearchParams) => void;

  selectedTrip: Trip | null;
  setSelectedTrip: (trip: Trip | null) => void;

  selectedSeats: number[];
  toggleSeat: (seat: number) => void;
  clearSeats: () => void;

  occupiedSeats: number[];
  setOccupiedSeats: (seats: number[]) => void;

  currentBooking: Booking | null;
  setCurrentBooking: (booking: Booking | null) => void;

  seatLayout: SeatLayout | null;
  setSeatLayout: (layout: SeatLayout | null) => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  searchParams: { origin: "", destination: "", date: "", agency: "" },
  setSearchParams: (params) => set({ searchParams: params }),

  selectedTrip: null,
  setSelectedTrip: (trip) => set({ selectedTrip: trip }),

  selectedSeats: [],
  toggleSeat: (seat) =>
    set((state) => ({
      selectedSeats: state.selectedSeats.includes(seat)
        ? state.selectedSeats.filter((s) => s !== seat)
        : [...state.selectedSeats, seat],
    })),
  clearSeats: () => set({ selectedSeats: [] }),

  occupiedSeats: [],
  setOccupiedSeats: (seats) => set({ occupiedSeats: seats }),

  currentBooking: null,
  setCurrentBooking: (booking) => set({ currentBooking: booking }),

  seatLayout: null,
  setSeatLayout: (layout) => set({ seatLayout: layout }),
}));

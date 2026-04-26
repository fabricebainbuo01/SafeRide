import { create } from "zustand";
import type { SearchParams, Trip, Booking, SeatLayout } from "@/types";

interface BookingState {
  searchParams: SearchParams;
  setSearchParams: (params: SearchParams) => void;

  searchResults: Trip[];
  setSearchResults: (trips: Trip[]) => void;

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

  isSearching: boolean;
  setIsSearching: (val: boolean) => void;

  isBooking: boolean;
  setIsBooking: (val: boolean) => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  searchParams: { origin: "", destination: "", date: "" },
  setSearchParams: (params) => set({ searchParams: params }),

  searchResults: [],
  setSearchResults: (trips) => set({ searchResults: trips }),

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

  isSearching: false,
  setIsSearching: (val) => set({ isSearching: val }),

  isBooking: false,
  setIsBooking: (val) => set({ isBooking: val }),
}));

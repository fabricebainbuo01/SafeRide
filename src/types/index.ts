export interface User {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: "passenger" | "agency_admin" | "super_admin";
  agency_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  is_active: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  region: string;
  is_active: boolean;
  created_at: string;
}

export interface SeatLayout {
  rows: number;
  cols: number;
  aisleAfter: number;
  unavailable: number[];
}

export interface Bus {
  id: string;
  agency_id: string;
  plate_number: string;
  model: string;
  capacity: number;
  seat_layout: SeatLayout;
  amenities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agency?: Agency;
}

export type TripStatus = "scheduled" | "boarding" | "departed" | "arrived" | "cancelled";

export interface Trip {
  id: string;
  agency_id: string;
  bus_id: string;
  origin_city_id: string;
  destination_city_id: string;
  departure_date: string;
  departure_time: string;
  estimated_arrival_time: string | null;
  price: number;
  currency: string;
  available_seats: number;
  status: TripStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  origin_city?: City;
  destination_city?: City;
  agency?: Agency;
  bus?: Bus;
}

export type BookingStatus = "confirmed" | "checked_in" | "cancelled" | "no_show";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type PaymentMethod = "mobile_money" | "cash" | "card";

export interface Booking {
  id: string;
  trip_id: string;
  user_id: string;
  seat_number: number;
  passenger_name: string;
  passenger_phone: string;
  booking_code: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  amount: number;
  currency: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  trip?: Trip;
}

export interface BusLocation {
  id: string;
  bus_id: string;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  recorded_at: string;
}

export interface SearchParams {
  origin: string;
  destination: string;
  date: string;
}

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

export type AgencySubscriptionStatus = "paid" | "overdue";

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
  subscription_status: AgencySubscriptionStatus;
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

export type AgencyRouteVerificationStatus = "pending" | "verified" | "rejected";

export interface AgencyRouteRow {
  id: string;
  agency_id: string;
  origin_city_id: string;
  destination_city_id: string;
  route_kind: "bus" | "camrail";
  stop_over_notes: string | null;
  indicative_price_xaf: number | null;
  verification_status: AgencyRouteVerificationStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  is_active: boolean;
  /** Super-admin only — promotes paying agencies on the public Routes explorer. */
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  origin_city?: Pick<City, "id" | "name"> | Pick<City, "id" | "name">[];
  destination_city?: Pick<City, "id" | "name"> | Pick<City, "id" | "name">[];
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
export type PaymentMethod = "mobile_money" | "cash" | "card" | "paypal";

export interface BookingGroup {
  id: string;
  user_id: string;
  trip_id: string;
  group_code: string;
  total_amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  bookings?: Booking[];
  trip?: Trip;
}

export interface Booking {
  id: string;
  group_id: string | null;
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
  group?: BookingGroup;
}

export interface AgencyApplication {
  id: string;
  user_id: string;
  proposed_name: string;
  proposed_slug: string;
  phone: string;
  address: string;
  city: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
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
  agency?: string;
  time?: string;
}

/**
 * Every monetisable booking interaction is a "lead" worth 300 XAF on the
 * Super Admin BI dashboard. New surfaces append to this union and the
 * matching CHECK constraint in `leads_tracking_kind_check`.
 */
export type LeadKind =
  | "whatsapp_confirm"
  | "ticket_download"
  | "ticket_print"
  | "qr_scan";

export interface LeadsTracking {
  id: string;
  kind: LeadKind;
  user_id: string | null;
  agency_id: string | null;
  trip_id: string | null;
  group_code: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** One row per route navigation; aggregated to "Total Traffic" on the BI dashboard. */
export interface PageView {
  id: string;
  path: string;
  user_id: string | null;
  referrer: string | null;
  created_at: string;
}

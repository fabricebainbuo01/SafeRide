"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { toastError } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { cn, localDateISOString } from "@/lib/utils";
import type { City, Agency } from "@/types";
import {
  ArrowRight,
  Shield,
  MapPin,
  MessageCircle,
  CreditCard,
  Ticket,
  Star,
  Calendar,
  ArrowUpDown,
  X,
} from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agency, setAgency] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<"origin" | "destination" | null>(null);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    async function fetchCities() {
      const { data, error } = await client!
        .from("cities")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) {
        console.error("Error fetching cities:", error);
        toastError(error, "Couldn't load cities");
        return;
      }
      if (data) setCities(data);
    }

    async function fetchAgencies() {
      const { data, error } = await client!
        .from("agencies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) {
        console.error("Error fetching agencies:", error);
        toastError(error, "Couldn't load agencies");
        return;
      }
      if (data) setAgencies(data);
    }

    fetchCities();
    fetchAgencies();
  }, []);

  const cityOptions = cities.map((c) => ({ value: c.id, label: c.name }));
  const agencyOptions = [{ value: "", label: "Any Agency" }, ...agencies.map((a) => ({ value: a.id, label: a.name }))];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !date) return;
    setLoading(true);
    let url = `/search?origin=${origin}&destination=${destination}&date=${date}`;
    if (agency) url += `&agency=${agency}`;
    if (time) url += `&time=${time}`;
    router.push(url);
  };

  const today = localDateISOString();

  const popularRoutes = [
    { from: "Douala", to: "Yaounde" },
    { from: "Yaounde", to: "Bafoussam" },
    { from: "Douala", to: "Bamenda" },
    { from: "Yaounde", to: "Bamenda" },
    { from: "Douala", to: "Buea" },
    { from: "Buea", to: "Bamenda" },
    { from: "Douala", to: "Limbe" },
    { from: "Bafoussam", to: "Garoua" },
  ];

  const testimonials = [
    {
      name: "Yusinyu. T",
      text: "I tried out their service recently and was very satisfied. They were very helpful in booking my ticket. Their customer service is top notch. I definitely recommend.",
    },
    {
      name: "S. Emma.",
      text: "App is user friendly, fast and it solves the problem for those who are far from travelling agencies, booking from the comfort of your home.",
    },
    {
      name: "P. Verdzekov.",
      text: "Beautiful one. No more stress for ticket payment. Now it is just so easy. Thanks to the developers.",
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-navy-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Travel Across Cameroon with Ease
            </h1>
            <p className="text-navy-300 text-lg mb-6 leading-relaxed">
              Book your bus or CAMRAIL passenger ticket online and confirm
              instantly via WhatsApp.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/routes"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-navy-700 text-white hover:bg-navy-600 transition-colors"
              >
                <MapPin size={16} />
                Explore Routes
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary-700 text-white hover:bg-primary-800 transition-colors"
              >
                Book a Ticket
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Booking Form */}
          <Card className="max-w-3xl mt-10 relative overflow-visible text-black">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-black">
                Book Your Trip
              </h2>
              {activeField && (
                <button 
                  onClick={() => setActiveField(null)}
                  className="text-xs text-navy-500 hover:text-navy-800 flex items-center gap-1"
                >
                  <X size={14} />
                  Close Selector
                </button>
              )}
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-4 items-end">
                <div className="sm:col-span-3 relative">
                  <Select
                    label="From"
                    options={cityOptions}
                    placeholder="Select city"
                    value={origin}
                    onChange={(e) => {
                      setOrigin(e.target.value);
                      setActiveField(null);
                    }}
                    onFocus={() => setActiveField("origin")}
                    id="origin"
                    className={cn(activeField === "origin" && "ring-2 ring-primary-700")}
                  />
                </div>

                <div className="flex justify-center sm:pb-2 -my-2 sm:my-0">
                  <button
                    type="button"
                    onClick={() => {
                      const temp = origin;
                      setOrigin(destination);
                      setDestination(temp);
                    }}
                    className="p-2 rounded-full bg-white sm:bg-transparent border border-navy-200 sm:border-0 hover:bg-navy-100 transition-colors text-navy-400 hover:text-primary-700"
                    aria-label="Swap origin and destination"
                    title="Swap cities"
                  >
                    <ArrowUpDown size={20} className="sm:rotate-90" />
                  </button>
                </div>

                <div className="sm:col-span-3">
                  <Select
                    label="To"
                    options={cityOptions}
                    placeholder="Select city"
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setActiveField(null);
                    }}
                    onFocus={() => setActiveField("destination")}
                    id="destination"
                    className={cn(activeField === "destination" && "ring-2 ring-action-700")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm font-medium text-black mb-1"
                  >
                    Travel Date
                  </label>
                  <input
                    type="date"
                    id="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-navy-300 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    htmlFor="time"
                    className="block text-sm font-medium text-black mb-1"
                  >
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    id="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-navy-300 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <Select
                    label="Travel Agency (Optional)"
                    options={agencyOptions}
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    id="agency"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    loading={loading}
                    disabled={!origin || !destination || !date}
                  >
                    Search Trips
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>

              {/* Interactive Town Selector */}
              {activeField && (
                <div className="mt-4 p-4 border-2 border-navy-100 bg-navy-50/50 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300 text-black">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-black">
                      Select {activeField === "origin" ? "Departure" : "Destination"} Town
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {cities.map((city) => (
                      <button
                        key={`quick-${activeField}-${city.id}`}
                        type="button"
                        onClick={() => {
                          if (activeField === "origin") {
                            setOrigin(city.id);
                            setActiveField("destination");
                          } else {
                            setDestination(city.id);
                            setActiveField(null);
                          }
                        }}
                        className={cn(
                          "px-3 py-2 text-xs font-medium border text-left transition-all hover:shadow-sm flex flex-col",
                          (activeField === "origin" ? origin : destination) === city.id
                            ? (activeField === "origin" 
                                ? "border-primary-700 bg-primary-100 text-primary-900" 
                                : "border-action-700 bg-action-100 text-action-900")
                            : "border-navy-200 bg-white text-navy-700 hover:border-primary-400"
                        )}
                      >
                        <span>{city.name}</span>
                        <span className="text-[9px] opacity-60 uppercase">{city.region}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-navy-400 text-center sm:text-left mt-2">
                By submitting, you agree to our{" "}
                <Link href="/terms" className="text-primary-700 hover:underline">
                  Terms &amp; Conditions
                </Link>
                . A SafeRide agent will confirm availability and price on
                WhatsApp.
              </p>
            </form>
          </Card>
        </div>
      </section>

      {/* Why Choose SafeRide */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-navy-800 mb-8">
          Why Choose SafeRide
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card hover>
            <div className="w-10 h-10 bg-primary-700 flex items-center justify-center mb-4">
              <Shield size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-800 mb-2">Safe &amp; Secure</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Your bookings are handled securely. We work with verified
              transport providers across Cameroon.
            </p>
          </Card>
          <Card hover>
            <div className="w-10 h-10 bg-action-700 flex items-center justify-center mb-4">
              <MapPin size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-800 mb-2">
              Reliable Planning
            </h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Plan routes between Douala, Yaounde, Bafoussam, Bamenda, Buea,
              Limbe, and more.
            </p>
          </Card>
          <Card hover>
            <div className="w-10 h-10 bg-navy-700 flex items-center justify-center mb-4">
              <Ticket size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-800 mb-2">Easy Booking</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Book in a few clicks on mobile or desktop. Confirm instantly via
              WhatsApp.
            </p>
          </Card>
          <Card hover>
            <div className="w-10 h-10 bg-primary-800 flex items-center justify-center mb-4">
              <CreditCard size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-800 mb-2">
              Payments (roadmap)
            </h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              MTN MoMo, Orange Money, and PayPal are being integrated next.
              Today you confirm with our team on WhatsApp; checkout includes a
              mock pay button for testing only.
            </p>
          </Card>
        </div>
      </section>

      {/* Popular Routes */}
      <section className="bg-navy-50 border-t border-b border-navy-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-navy-800 mb-2">
            Popular Routes
          </h2>
          <p className="text-sm text-navy-500 mb-8">
            Click a route to auto-fill the booking form. Includes bus routes
            and CAMRAIL passenger routes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularRoutes.map((route) => (
              <button
                key={`${route.from}-${route.to}`}
                type="button"
                className="p-4 bg-white border border-navy-200 hover:border-primary-700 transition-colors text-left"
                onClick={() => {
                  const originCity = cities.find((c) => c.name === route.from);
                  const destCity = cities.find((c) => c.name === route.to);
                  if (originCity && destCity) {
                    router.push(
                      `/search?origin=${originCity.id}&destination=${destCity.id}&date=${today}`
                    );
                  }
                }}
              >
                <p className="font-semibold text-navy-800 text-sm">
                  {route.from}
                </p>
                <div className="flex items-center gap-2 my-1">
                  <div className="h-px flex-1 bg-navy-300" />
                  <ArrowRight size={12} className="text-navy-400" />
                </div>
                <p className="font-semibold text-navy-800 text-sm">
                  {route.to}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About Snippet */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-navy-800 mb-4">
            About SafeRide
          </h2>
          <p className="text-navy-600 leading-relaxed mb-4">
            SafeRide Cameroon simplifies the booking process for bus and CAMRAIL
            passenger tickets in Cameroon. We partner with major operators like
            Amour Mezam, Musango, Moghamo Express, Vatican Express, and Oasis
            Travel to make buying tickets easier and more convenient -- so your
            travel stays smooth, reliable, and hassle-free.
          </p>
          <div className="flex gap-3">
            <a
              href="https://wa.me/237683073601"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 border border-primary-700 hover:bg-primary-50 transition-colors"
            >
              <MessageCircle size={16} />
              Contact on WhatsApp
            </a>
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy-600 border border-navy-300 hover:bg-navy-50 transition-colors"
            >
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-navy-50 border-t border-b border-navy-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-navy-800 mb-8">
            What Our Customers Say
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} hover>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      className="text-primary-700 fill-primary-700"
                    />
                  ))}
                </div>
                <p className="text-sm text-navy-600 leading-relaxed mb-4">
                  &ldquo;{t.text}&rdquo;
                </p>
                <p className="text-sm font-semibold text-navy-800">{t.name}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Explore routes */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-navy-800 text-white p-8 sm:p-12 overflow-hidden relative">
          <div className="max-w-2xl z-10 relative">
            <h2 className="text-3xl font-bold mb-4">
              Explore inter-urban routes
            </h2>
            <p className="text-navy-300 text-lg leading-relaxed mb-8">
              Browse verified bus corridors and CAMRAIL passenger routes across Cameroon,
              then jump straight into search for live schedules and fares.
            </p>
            <Link
              href="/routes"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold bg-primary-700 text-white hover:bg-primary-800 transition-all hover-scale active-scale"
            >
              <Calendar size={20} />
              Explore Routes
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="absolute -bottom-16 -right-10 w-56 h-56 bg-primary-700/15 rounded-full blur-3xl pointer-events-none" />
        </div>
      </section>
    </div>
  );
}

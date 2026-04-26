"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import type { City } from "@/types";
import {
  ArrowRight,
  Shield,
  Clock,
  MapPin,
  MessageCircle,
  Smartphone,
  CreditCard,
  Ticket,
  Star,
  Download,
} from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchCities() {
      const { data } = await supabase
        .from("cities")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (data) setCities(data);
    }
    fetchCities();
  }, []);

  const cityOptions = cities.map((c) => ({ value: c.id, label: c.name }));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !date) return;
    setLoading(true);
    router.push(`/search?origin=${origin}&destination=${destination}&date=${date}`);
  };

  const today = new Date().toISOString().split("T")[0];

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
              <a
                href="https://play.google.com/store/apps/details?id=com.saferide.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-navy-700 text-white hover:bg-navy-600 transition-colors"
              >
                <Download size={16} />
                Download Mobile App
              </a>
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
          <Card className="max-w-3xl mt-10">
            <h2 className="text-lg font-bold text-navy-800 mb-4">
              Book Your Trip
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="From"
                  options={cityOptions}
                  placeholder="Select city"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  id="origin"
                />
                <Select
                  label="To"
                  options={cityOptions}
                  placeholder="Select city"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  id="destination"
                />
                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm font-medium text-navy-700 mb-1"
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    id="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-navy-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  disabled={!origin || !destination || !date}
                >
                  Search Trips
                  <ArrowRight size={16} className="ml-2" />
                </Button>
                <p className="text-xs text-navy-400">
                  By submitting, you agree to our{" "}
                  <Link href="/terms" className="text-primary-700 hover:underline">
                    Terms &amp; Conditions
                  </Link>
                  . A SafeRide agent will confirm availability and price on
                  WhatsApp.
                </p>
              </div>
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
          <Card>
            <div className="w-10 h-10 bg-primary-700 flex items-center justify-center mb-4">
              <Shield size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-800 mb-2">Safe &amp; Secure</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Your bookings are handled securely. We work with verified
              transport providers across Cameroon.
            </p>
          </Card>
          <Card>
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
          <Card>
            <div className="w-10 h-10 bg-navy-700 flex items-center justify-center mb-4">
              <Smartphone size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-800 mb-2">Easy Booking</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Book in a few clicks on mobile or desktop. Confirm instantly via
              WhatsApp.
            </p>
          </Card>
          <Card>
            <div className="w-10 h-10 bg-primary-800 flex items-center justify-center mb-4">
              <CreditCard size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-800 mb-2">
              Mobile Money &amp; PayPal
            </h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Pay securely with MTN MoMo, Orange Money, or PayPal. Receive
              your e-ticket instantly.
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
              href="https://wa.me/237678149836"
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
              <Card key={t.name}>
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

      {/* Download App */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-navy-800 text-white p-8 sm:p-12">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-3">
              Download Our Mobile App
            </h2>
            <p className="text-navy-300 leading-relaxed mb-6">
              Book tickets on the go with our easy-to-use mobile application.
              Available on Android and iOS.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=com.saferide.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white text-navy-800 hover:bg-navy-100 transition-colors"
              >
                <Download size={16} />
                Get it on Google Play
              </a>
              <a
                href="https://apps.apple.com/app/saferide"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-white text-white hover:bg-navy-700 transition-colors"
              >
                <Download size={16} />
                Download on App Store
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

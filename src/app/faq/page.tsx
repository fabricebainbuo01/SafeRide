import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "FAQ | SafeRide",
  description:
    "Frequently asked questions about booking inter-urban bus and CAMRAIL tickets with SafeRide Cameroon.",
};

const faqs = [
  {
    q: "How do I book a ticket?",
    a: "Search a route from the home page, pick a trip, choose your seats, enter passenger details, and confirm. You'll receive a booking code immediately.",
  },
  {
    q: "How do I pay for my ticket?",
    a: "Bookings are currently held as pending until a SafeRide agent confirms availability with you on WhatsApp. Mobile Money (MTN MoMo, Orange Money) and PayPal payment integration is rolling out next.",
  },
  {
    q: "Can I cancel my booking?",
    a: "Yes — open a confirmed booking from your dashboard and tap Cancel. You can only self-cancel before check-in. After check-in, contact the agency directly.",
  },
  {
    q: "What happens if a trip is cancelled?",
    a: "If the agency cancels a trip, the seat is released automatically and the booking is marked cancelled. We'll work with the agency to refund any paid amount.",
  },
  {
    q: "Do I need to print my ticket?",
    a: "No — your booking code is enough. Show it on your phone (or printed) at the agency counter at least 30 minutes before departure.",
  },
  {
    q: "I'm a transport agency. How do I list my trips?",
    a: "Register and sign in as a passenger — you’ll see “Apply to list your agency” on your dashboard and in the footer under Support while your role is passenger. A SafeRide super-admin will review and approve. Once approved, you'll get access to the agency portal at /admin.",
  },
  {
    q: "Is real-time bus tracking available?",
    a: "We're building this out. Once your trip is in 'departed' status and the agency has GPS enabled on the bus, you'll see live progress on your ticket.",
  },
  {
    q: "Which agencies do you work with?",
    a: "Amour Mezam, Musango, Moghamo Express, Vatican Express, Oasis Travel, Buca Voyages, Garantie Express, General Express, Touristique Express, Finexs, Danay Express, United Express, Menoua Voyage, and Tresor Voyage. More are joining each month.",
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-navy-800 mb-2">
        Frequently Asked Questions
      </h1>
      <p className="text-navy-500 mb-8">
        Everything you need to know about booking with SafeRide.
      </p>

      <div className="space-y-4">
        {faqs.map((item) => (
          <Card key={item.q}>
            <h2 className="font-semibold text-navy-800 mb-2">{item.q}</h2>
            <p className="text-sm text-navy-600 leading-relaxed">{item.a}</p>
          </Card>
        ))}
      </div>

      <div className="mt-12 p-6 border border-navy-200 bg-navy-50">
        <h3 className="font-semibold text-navy-800 mb-1">Still need help?</h3>
        <p className="text-sm text-navy-600">
          Reach us on{" "}
          <a
            href="https://wa.me/237683073601"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-700 hover:underline"
          >
            WhatsApp
          </a>{" "}
          or call <a href="tel:+237683073601" className="text-primary-700 hover:underline">+237 683 073 601</a>.
        </p>
      </div>
    </div>
  );
}

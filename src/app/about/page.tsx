import { Card } from "@/components/ui/Card";
import { Shield, Users, MapPin, Smartphone, CreditCard, Headphones } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-navy-800 mb-4">About SafeRide</h1>

      <div className="max-w-3xl">
        <p className="text-navy-600 leading-relaxed mb-6">
          SafeRide Cameroon is a registered business entity under the Cameroon
          Trade and Property Rights Register. SafeRide simplifies the booking
          process for bus and CAMRAIL passenger tickets in Cameroon. We partner
          with major operators to make buying tickets easier and more convenient
          -- so your travel stays smooth, reliable, and hassle-free.
        </p>

        <p className="text-navy-600 leading-relaxed mb-8">
          With SafeRide, you can view schedules and fares from top agencies like
          Amour Mezam, Musango, Moghamo Express, Vatican Express, and Oasis
          Travel. Book trips between major cities such as Yaounde, Douala,
          Bamenda, Buea, Limbe, Kumba, Garoua, Maroua, Bafoussam, and
          Ngaoundere. Confirm availability with our team on WhatsApp; digital
          wallet and card payments through licensed providers are rolling out as
          our next major release.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-navy-800 mb-6">What We Offer</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card>
          <div className="w-10 h-10 bg-primary-700 flex items-center justify-center mb-4">
            <Shield size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-navy-800 mb-2">Verified Operators</h3>
          <p className="text-sm text-navy-500 leading-relaxed">
            We work only with verified and trusted transport providers across
            Cameroon to ensure your safety and comfort.
          </p>
        </Card>
        <Card>
          <div className="w-10 h-10 bg-action-700 flex items-center justify-center mb-4">
            <Users size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-navy-800 mb-2">Multiple Agencies</h3>
          <p className="text-sm text-navy-500 leading-relaxed">
            Compare schedules and fares from multiple agencies in one place.
            Choose the best option for your trip.
          </p>
        </Card>
        <Card>
          <div className="w-10 h-10 bg-navy-700 flex items-center justify-center mb-4">
            <MapPin size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-navy-800 mb-2">Nationwide Coverage</h3>
          <p className="text-sm text-navy-500 leading-relaxed">
            Covering all major inter-urban routes across Cameroon, including
            CAMRAIL passenger train routes.
          </p>
        </Card>
        <Card>
          <div className="w-10 h-10 bg-primary-800 flex items-center justify-center mb-4">
            <Smartphone size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-navy-800 mb-2">Mobile Friendly</h3>
          <p className="text-sm text-navy-500 leading-relaxed">
            Book from your phone or desktop. Explore routes and schedules in one place—no app install required.
          </p>
        </Card>
        <Card>
          <div className="w-10 h-10 bg-action-800 flex items-center justify-center mb-4">
            <CreditCard size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-navy-800 mb-2">Payments</h3>
          <p className="text-sm text-navy-500 leading-relaxed">
            Mobile Money and PayPal integrations are in progress. Until live PSP
            hooks ship, bookings are confirmed with SafeRide on WhatsApp (with a
            mock checkout path for QA).
          </p>
        </Card>
        <Card>
          <div className="w-10 h-10 bg-navy-800 flex items-center justify-center mb-4">
            <Headphones size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-navy-800 mb-2">24/7 Support</h3>
          <p className="text-sm text-navy-500 leading-relaxed">
            Reach us anytime via WhatsApp, phone, or email. Our team is ready
            to help with bookings and travel questions.
          </p>
        </Card>
      </div>

      <h2 className="text-2xl font-bold text-navy-800 mb-4">Contact Us</h2>
      <div className="max-w-3xl space-y-2 text-navy-600 text-sm">
        <p>
          <span className="font-medium text-navy-800">Address:</span> Foncha
          Street, Bamenda-Cameroon
        </p>
        <p>
          <span className="font-medium text-navy-800">Phone:</span>{" "}
          <a href="tel:+237683073601" className="text-primary-700 hover:underline">
            +237 683.073.601
          </a>
        </p>
        <p>
          <span className="font-medium text-navy-800">Email:</span>{" "}
          <a href="mailto:info@saferide.cm" className="text-primary-700 hover:underline">
            info@saferide.cm
          </a>
        </p>
        <p>
          <span className="font-medium text-navy-800">WhatsApp:</span>{" "}
          <a
            href="https://wa.me/237683073601"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-700 hover:underline"
          >
            Chat with us
          </a>
        </p>
      </div>
    </div>
  );
}

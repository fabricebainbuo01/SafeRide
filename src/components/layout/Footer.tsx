import Link from "next/link";
import { MapPin } from "lucide-react";
import { FooterPassengerApplyLink } from "@/components/layout/FooterPassengerApplyLink";

export function Footer() {
  return (
    <footer className="border-t border-navy-200 bg-navy-800 text-navy-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-700 flex items-center justify-center">
                <span className="text-white text-sm font-bold">SR</span>
              </div>
              <span className="text-white font-bold text-lg">SafeRide</span>
            </div>
            <p className="text-sm text-navy-400 leading-relaxed mb-4">
              Your trusted partner for bus travel and CAMRAIL passenger routes
              across Cameroon.
            </p>
            <Link
              href="/routes"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 transition-colors"
            >
              <MapPin size={16} />
              Explore Routes
            </Link>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-navy-400 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-sm text-navy-400 hover:text-white transition-colors">
                  Book Tickets
                </Link>
              </li>
              <li>
                <Link href="/routes" className="text-sm text-navy-400 hover:text-white transition-colors">
                  Explore Routes
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-navy-400 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-navy-400 hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/news" className="text-sm text-navy-400 hover:text-white transition-colors">
                  News
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Support
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://wa.me/237683073601"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-navy-400 hover:text-white transition-colors"
                >
                  WhatsApp Support
                </a>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-navy-400 hover:text-white transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
              <FooterPassengerApplyLink />
              <li>
                <Link href="/admin" className="text-sm text-navy-400 hover:text-white transition-colors">
                  Agency Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Contact Info
            </h4>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-navy-400">
                  Foncha Street, Bamenda-Cameroon
                </span>
              </li>
              <li>
                <a
                  href="tel:+237683073601"
                  className="text-sm text-navy-400 hover:text-white transition-colors"
                >
                  +237 683.073.601
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@saferide.cm"
                  className="text-sm text-navy-400 hover:text-white transition-colors"
                >
                  info@saferide.cm
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-navy-500">
            SafeRide Cameroon. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/terms" className="text-xs text-navy-500 hover:text-white transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/faq" className="text-xs text-navy-500 hover:text-white transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

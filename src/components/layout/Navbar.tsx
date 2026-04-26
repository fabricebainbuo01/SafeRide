"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, User, Phone, MessageCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Book Tickets" },
  { href: "/routes", label: "Routes" },
  { href: "/about", label: "About Us" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/news", label: "News" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-navy-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-700 flex items-center justify-center">
              <span className="text-white text-sm font-bold">SR</span>
            </div>
            <span className="text-navy-800 font-bold text-lg tracking-tight">
              SafeRide
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "text-primary-700 border-b-2 border-primary-700"
                    : "text-navy-600 hover:text-navy-800"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href="https://wa.me/237678149836"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 hover:text-primary-800 transition-colors"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
            <a
              href="tel:+237678149836"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-navy-600 hover:text-navy-800 transition-colors"
            >
              <Phone size={14} />
              Call
            </a>
            <Link
              href="/auth/login"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-navy-700 hover:text-navy-900 transition-colors"
            >
              <User size={16} />
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 transition-colors"
            >
              Register
            </Link>
          </div>

          <button
            className="lg:hidden p-2 text-navy-600"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-navy-200 pb-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block px-4 py-3 text-sm font-medium border-b border-navy-100",
                  pathname === link.href
                    ? "text-primary-700 bg-primary-50"
                    : "text-navy-600"
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 px-4 pt-3">
              <a
                href="https://wa.me/237678149836"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 text-sm font-medium text-primary-700 border border-primary-700 text-center"
              >
                WhatsApp
              </a>
              <a
                href="tel:+237678149836"
                className="flex-1 px-3 py-2 text-sm font-medium text-navy-700 border border-navy-300 text-center"
              >
                Call Us
              </a>
            </div>
            <div className="flex flex-col gap-2 px-4 pt-3">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm font-medium text-navy-700 border border-navy-300 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-700 text-center"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

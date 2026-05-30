"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  User,
  Phone,
  MessageCircle,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Shield,
  ClipboardList,
  MapPin,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import { hasSupabaseConfig } from "@/lib/env";
import { SafeRideLogo } from "@/components/ui/SafeRideLogo";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Book Tickets" },
  { href: "/routes", label: "Explore Routes", icon: MapPin },
  { href: "/about", label: "About Us" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/news", label: "News" },
];

function avatarLetter(user: SupabaseUser): string {
  const name =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  if (name.length > 0) return name[0]!.toUpperCase();
  const email = user.email ?? "";
  return email.length > 0 ? email[0]!.toUpperCase() : "?";
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabase();
    if (!client || !authUser) {
      setProfileRole(null);
      return;
    }
    let cancelled = false;
    void client
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfileRole(data?.role ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    client.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        setAuthUser(session?.user ?? null);
        setAuthReady(true);
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    setMenuOpen(false);
    setMobileOpen(false);
    await client.auth.signOut();
    window.location.assign("/");
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        desktopMenuRef.current?.contains(t) ||
        mobileMenuRef.current?.contains(t)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const phoneFromMeta =
    typeof authUser?.user_metadata?.phone === "string"
      ? authUser.user_metadata.phone.trim()
      : "";

  const renderAuthControlsDesktop = () => {
    if (!hasSupabaseConfig) {
      return (
        <>
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
        </>
      );
    }

    if (!authReady) {
      return (
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-pulse rounded bg-navy-100" />
        </div>
      );
    }

    if (!authUser) {
      return (
        <>
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
        </>
      );
    }

    return (
      <div className="relative" ref={desktopMenuRef}>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border-2 border-primary-600 bg-white p-0.5 shadow-sm outline-none ring-primary-600 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-offset-2"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Account menu"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#059669] to-[#10b981] text-sm font-semibold text-white">
            {avatarLetter(authUser)}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "mr-1 text-primary-700 transition-transform",
              menuOpen && "rotate-180"
            )}
          />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 z-[60] mt-2 w-64 rounded-md border border-navy-200 bg-white py-2 shadow-lg ring-1 ring-black/5"
            role="menu"
          >
            <div className="border-b border-navy-100 px-4 pb-3 pt-1">
              <p className="text-xs text-navy-400">Email</p>
              <p className="truncate text-sm text-navy-700">
                {authUser.email ?? "—"}
              </p>
            </div>
            <div className="border-b border-navy-100 px-4 py-3">
              <p className="text-xs text-navy-400">Phone</p>
              <p className="truncate text-sm text-navy-700">
                {phoneFromMeta || "—"}
              </p>
            </div>
            <div className="border-b border-navy-100 px-2 py-2">
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-navy-800 transition-colors hover:bg-primary-50 hover:text-primary-800"
              >
                <LayoutDashboard size={16} className="text-primary-700" />
                Passenger dashboard
              </Link>
            </div>
            {profileRole === "super_admin" && (
              <div className="border-b border-navy-100 px-2 py-2 space-y-0.5">
                <Link
                  href="/admin/super"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-navy-800 transition-colors hover:bg-primary-50 hover:text-primary-800"
                >
                  <Shield size={16} className="text-primary-700" />
                  Super dashboard
                </Link>
                <Link
                  href="/admin/applications"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-navy-800 transition-colors hover:bg-primary-50 hover:text-primary-800"
                >
                  <ClipboardList size={16} className="text-primary-700" />
                  Agency applications
                </Link>
              </div>
            )}
            <div className="px-2 pt-2">
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAuthControlsMobile = () => {
    if (!hasSupabaseConfig) {
      return (
        <>
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
        </>
      );
    }

    if (!authReady) {
      return (
        <div className="px-4 pt-3">
          <div className="h-11 w-full animate-pulse rounded-md bg-navy-100" />
        </div>
      );
    }

    if (!authUser) {
      return (
        <>
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
        </>
      );
    }

    return (
      <div className="relative px-4 pt-3" ref={mobileMenuRef}>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-primary-600 bg-white px-3 py-2"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#059669] to-[#10b981] text-sm font-semibold text-white">
              {avatarLetter(authUser)}
            </span>
            <span className="text-sm font-medium text-navy-800">Account</span>
          </span>
          <ChevronDown
            size={18}
            className={cn(
              "text-primary-700 transition-transform",
              menuOpen && "rotate-180"
            )}
          />
        </button>
        {menuOpen && (
          <div className="mt-2 space-y-3 rounded-md border border-navy-200 bg-navy-50 p-4">
            <div>
              <p className="text-xs text-navy-400">Email</p>
              <p className="break-all text-sm text-navy-700">
                {authUser.email ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-400">Phone</p>
              <p className="text-sm text-navy-700">{phoneFromMeta || "—"}</p>
            </div>
            <Link
              href="/dashboard"
              onClick={() => {
                setMenuOpen(false);
                setMobileOpen(false);
              }}
              className="flex items-center justify-center gap-2 rounded border border-primary-200 bg-white px-4 py-2 text-sm font-medium text-primary-800 hover:bg-primary-50"
            >
              <LayoutDashboard size={16} />
              Passenger dashboard
            </Link>
            {profileRole === "super_admin" && (
              <>
                <Link
                  href="/admin/super"
                  onClick={() => {
                    setMenuOpen(false);
                    setMobileOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 rounded border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
                >
                  <Shield size={16} />
                  Super dashboard
                </Link>
                <Link
                  href="/admin/applications"
                  onClick={() => {
                    setMenuOpen(false);
                    setMobileOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 rounded border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
                >
                  <ClipboardList size={16} />
                  Agency applications
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center justify-center gap-2 rounded border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="border-b border-navy-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <SafeRideLogo size="sm" priority />

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const IconComp = "icon" in link ? link.icon : undefined;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
                    pathname === link.href
                      ? "text-primary-700 border-b-2 border-primary-700"
                      : "text-navy-600 hover:text-navy-800"
                  )}
                >
                  {IconComp ? <IconComp size={14} /> : null}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href="https://wa.me/237683073601"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 hover:text-primary-800 transition-colors"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
            <a
              href="tel:+237683073601"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-navy-600 hover:text-navy-800 transition-colors"
            >
              <Phone size={14} />
              Call
            </a>
            {renderAuthControlsDesktop()}
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
            {navLinks.map((link) => {
              const IconComp = "icon" in link ? link.icon : undefined;
              return (
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
                  <span className="inline-flex items-center gap-2">
                    {IconComp ? <IconComp size={16} /> : null}
                    {link.label}
                  </span>
                </Link>
              );
            })}
            <div className="flex gap-2 px-4 pt-3">
              <a
                href="https://wa.me/237683073601"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 text-sm font-medium text-primary-700 border border-primary-700 text-center"
              >
                WhatsApp
              </a>
              <a
                href="tel:+237683073601"
                className="flex-1 px-3 py-2 text-sm font-medium text-navy-700 border border-navy-300 text-center"
              >
                Call Us
              </a>
            </div>
            <div className="flex flex-col gap-2 pt-3">
              {renderAuthControlsMobile()}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

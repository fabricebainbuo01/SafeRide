"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bus,
  Calendar,
  Ticket,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/fleet", label: "Fleet", icon: Bus },
  { href: "/admin/schedules", label: "Schedules", icon: Calendar },
  { href: "/admin/bookings", label: "Bookings", icon: Ticket },
  { href: "/admin/revenue", label: "Revenue", icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] border-r border-navy-200 bg-navy-50">
      <div className="p-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-navy-500 hover:text-navy-800 mb-6"
        >
          <ArrowLeft size={14} />
          Back to Site
        </Link>

        <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4">
          Agency Admin
        </h2>

        <nav className="space-y-1">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-700 text-white"
                    : "text-navy-600 hover:bg-navy-100 hover:text-navy-800"
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

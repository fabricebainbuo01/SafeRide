import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "News & Updates | SafeRide",
  description:
    "Latest announcements, route additions, and product updates from SafeRide Cameroon.",
};

const posts = [
  {
    date: "April 2026",
    tag: "Product",
    title: "Multi-seat group bookings",
    body: "You can now book several seats in a single transaction and receive one consolidated booking group with one code per seat. Easier for families and group trips.",
  },
  {
    date: "April 2026",
    tag: "Security",
    title: "Hardened booking policies",
    body: "We've tightened our row-level security so booking amounts and payment status can only be set by trusted server-side flows — no more risk of clients self-marking bookings as paid.",
  },
  {
    date: "March 2026",
    tag: "Routes",
    title: "Kribi route now bookable",
    body: "Douala → Kribi is now live with daily morning departures. Perfect for weekend getaways to the coast.",
  },
  {
    date: "February 2026",
    tag: "Agencies",
    title: "Agency self-onboarding",
    body: "Transport agencies can now apply directly through the dashboard. After review, you get full access to fleet, schedules, bookings, and revenue tools.",
  },
];

const tagVariant: Record<string, "info" | "success" | "warning" | "default"> = {
  Product: "info",
  Security: "warning",
  Routes: "success",
  Agencies: "default",
};

export default function NewsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-navy-800 mb-2">News &amp; Updates</h1>
      <p className="text-navy-500 mb-10">
        What&apos;s new on SafeRide.
      </p>

      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.title}>
            <div className="flex items-center gap-3 mb-3">
              <Badge variant={tagVariant[post.tag] ?? "default"}>{post.tag}</Badge>
              <span className="flex items-center gap-1 text-xs text-navy-400">
                <Calendar size={12} />
                {post.date}
              </span>
            </div>
            <h2 className="font-semibold text-navy-800 mb-2">{post.title}</h2>
            <p className="text-sm text-navy-600 leading-relaxed">{post.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

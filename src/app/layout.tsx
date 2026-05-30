import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Toaster } from "@/components/ui/Toaster";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { SAFERIDE_LOGO_SRC } from "@/lib/brand";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeRide - Inter-Urban Bus Booking",
  description:
    "Book inter-urban bus trips across Cameroon. Search routes, select seats, and travel safely with SafeRide.",
  icons: {
    icon: SAFERIDE_LOGO_SRC,
    apple: SAFERIDE_LOGO_SRC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster />
        <PageViewTracker />
      </body>
    </html>
  );
}

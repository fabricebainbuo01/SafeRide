import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import type { Booking } from "@/types";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

/** Numeric sRGB only — jsPDF cannot parse CSS `lab()` / `oklch()`. */
const NAVY = { r: 30, g: 41, b: 59 };
const NAVY_MUTED = { r: 100, g: 116, b: 139 };
const PRIMARY = { r: 21, g: 128, b: 61 };

/**
 * Vector PDF ticket — avoids DOM screenshot libs that choke on Tailwind v4 `lab()` colors.
 */
export async function buildTicketPdf(booking: Booking): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const m = 14;
  let y = m;
  const trip = booking.trip;
  const colMid = pw / 2 + 3;

  // Header
  pdf.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  pdf.rect(0, 0, pw, 26, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("SafeRide", m, 17);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Inter-Urban Bus Ticket", m, 22);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(booking.status.replace("_", " ").toUpperCase(), pw - m, 17, {
    align: "right",
  });

  y = 34;
  pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  pdf.setFontSize(7);
  pdf.setTextColor(NAVY_MUTED.r, NAVY_MUTED.g, NAVY_MUTED.b);
  pdf.text("BOOKING CODE", pw / 2, y, { align: "center" });
  y += 5;
  pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(17);
  pdf.text(booking.booking_code, pw / 2, y, { align: "center" });
  y += 10;

  // Encode the same /ticket/[code]?qr=1 URL the on-screen QR uses, so PDF
  // scans land on the tracked endpoint and roll up into Booking Leads.
  const qrPayload =
    typeof window !== "undefined"
      ? `${window.location.origin}/ticket/${booking.booking_code}?qr=1`
      : booking.booking_code;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 240,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  const qrMm = 42;
  pdf.addImage(qrDataUrl, "PNG", (pw - qrMm) / 2, y, qrMm, qrMm);
  y += qrMm + 4;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(NAVY_MUTED.r, NAVY_MUTED.g, NAVY_MUTED.b);
  pdf.text("Scan or present booking code at the counter", pw / 2, y, {
    align: "center",
  });
  y += 10;

  if (trip) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.text(`Departure: ${trip.origin_city?.name ?? "—"}`, m, y);
    y += 6;
    pdf.text(`Arrival: ${trip.destination_city?.name ?? "—"}`, m, y);
    y += 10;
  }

  const half = pw / 2 - m - 3;

  const pairRow = (labL: string, valL: string, labR: string, valR: string) => {
    let depth = 0;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(NAVY_MUTED.r, NAVY_MUTED.g, NAVY_MUTED.b);
    pdf.text(labL, m, y);
    pdf.text(labR, colMid, y);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    const linesL = pdf.splitTextToSize(valL, half);
    const linesR = pdf.splitTextToSize(valR, half);
    pdf.text(linesL, m, y + 4);
    pdf.text(linesR, colMid, y + 4);
    depth = Math.max(linesL.length, linesR.length) * 5 + 6;
    y += depth;
  };

  pairRow(
    "Date",
    trip ? formatDate(trip.departure_date) : "N/A",
    "Departure time",
    trip ? formatTime(trip.departure_time) : "N/A"
  );
  pairRow("Seat", String(booking.seat_number), "Agency", trip?.agency?.name ?? "N/A");
  pairRow("Passenger", booking.passenger_name, "Phone", booking.passenger_phone);

  pdf.setDrawColor(NAVY_MUTED.r, NAVY_MUTED.g, NAVY_MUTED.b);
  pdf.line(m, y, pw - m, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(NAVY_MUTED.r, NAVY_MUTED.g, NAVY_MUTED.b);
  pdf.text("Amount", m, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  pdf.text(formatCurrency(booking.amount, booking.currency), pw - m, y, {
    align: "right",
  });
  y += 10;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(NAVY_MUTED.r, NAVY_MUTED.g, NAVY_MUTED.b);
  pdf.text("Payment:", m, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  pdf.text(booking.payment_status.toUpperCase(), m + 22, y);
  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(NAVY_MUTED.r, NAVY_MUTED.g, NAVY_MUTED.b);
  const footer =
    "Present this ticket with the booking code at the agency counter. Arrive 30 minutes before departure.";
  pdf.text(pdf.splitTextToSize(footer, pw - 2 * m), m, y);

  return pdf;
}

export async function saveTicketPdf(booking: Booking, filenameCode: string): Promise<void> {
  const pdf = await buildTicketPdf(booking);
  pdf.save(`saferide-ticket-${filenameCode}.pdf`);
}

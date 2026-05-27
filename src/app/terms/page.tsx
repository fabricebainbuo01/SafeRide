import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | SafeRide",
  description:
    "SafeRide Cameroon terms of use, booking conditions, and refund policy.",
};

const sections = [
  {
    title: "1. Acceptance of Terms",
    body: "By using SafeRide Cameroon (the 'Service'), you agree to these Terms & Conditions. If you do not agree, please do not use the Service.",
  },
  {
    title: "2. The Service",
    body: "SafeRide is a booking platform that connects travellers with licensed inter-urban transport providers and CAMRAIL passenger services across Cameroon. SafeRide does not operate the buses or trains directly; we facilitate booking, payment, and communication.",
  },
  {
    title: "3. Bookings & Tickets",
    body: "Each booking generates a unique code. The booking is confirmed once payment is received (where applicable) or once a SafeRide agent confirms availability on WhatsApp. You must present your booking code at the agency counter at least 30 minutes before departure.",
  },
  {
    title: "4. Payments",
    body: "Where online payment is enabled, you may pay via MTN Mobile Money, Orange Money, card, or PayPal. All payments are processed by our payment partners; SafeRide never stores your card or wallet credentials.",
  },
  {
    title: "5. Cancellations & Refunds",
    body: "You can self-cancel a confirmed booking from your dashboard up until check-in. Refunds for cancelled trips, where applicable, are processed by the operating agency within 7 business days. SafeRide is not responsible for delays caused by the agency.",
  },
  {
    title: "6. Agency Responsibilities",
    body: "Agencies listed on SafeRide are responsible for the safety, schedule reliability, and quality of their service. SafeRide vets agencies before listing them but cannot guarantee individual trip outcomes.",
  },
  {
    title: "7. Liability",
    body: "SafeRide's liability is limited to the booking fee paid through the platform. We are not liable for indirect or consequential losses arising from delays, cancellations, accidents, or lost belongings.",
  },
  {
    title: "8. Privacy",
    body: "We collect only the data needed to process your bookings: name, phone, email, and trip details. We do not sell your data. See the privacy notice in your dashboard for full details.",
  },
  {
    title: "9. Changes",
    body: "These terms may be updated from time to time. Continued use of the Service after a change constitutes acceptance of the updated terms.",
  },
  {
    title: "10. Contact",
    body: "Questions or complaints: info@saferide.cm or +237 683 073 601.",
  },
];

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-navy-800 mb-2">
        Terms &amp; Conditions
      </h1>
      <p className="text-sm text-navy-500 mb-10">
        Last updated: April 2026
      </p>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-semibold text-navy-800 mb-2">
              {section.title}
            </h2>
            <p className="text-sm text-navy-600 leading-relaxed">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}

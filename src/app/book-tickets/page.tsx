import { redirect } from "next/navigation";

/** Entry point for “Book a ticket” CTAs; search is where trips are discovered. */
export default function BookTicketsPage() {
  redirect("/search");
}

import { NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceSupabase,
  createSupabaseWithAccessToken,
} from "@/lib/supabase-server";

/**
 * MOCK payment confirmation endpoint.
 *
 * Until a real provider (MTN MoMo / Orange Money / PayPal) is wired in,
 * this endpoint flips a booking_group's payment_status to 'paid' so the rest
 * of the UI/dashboard can be tested end-to-end.
 *
 * Replace this handler with:
 *   - A provider-specific webhook (verifies HMAC signature)
 *   - That calls createServiceSupabase() and updates the same rows
 *
 * The approach (service role + idempotent update) is the same — only the
 * trigger source changes.
 */
export async function POST(req: Request) {
  let body: { group_code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const groupCode = body?.group_code;
  if (!groupCode || typeof groupCode !== "string") {
    return NextResponse.json({ error: "group_code is required" }, { status: 400 });
  }

  // 1) Authenticate — prefer Bearer token from the browser session (localStorage),
  //    fall back to cookies for setups that use cookie-based auth.
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const supabase = bearer
    ? createSupabaseWithAccessToken(bearer)
    : await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Verify ownership through the user-scoped client (RLS protects this).
  // total_amount is computed by the DB from bookings.amount (which itself is
  // pinned to trips.price by RLS), so we can trust whatever value is stored.
  const { data: group, error: lookupErr } = await supabase
    .from("booking_groups")
    .select("id, user_id, payment_status, total_amount, currency")
    .eq("group_code", groupCode)
    .maybeSingle();

  if (lookupErr || !group) {
    return NextResponse.json({ error: "Booking group not found" }, { status: 404 });
  }
  if (group.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (group.payment_status === "paid") {
    return NextResponse.json({ ok: true, already_paid: true });
  }

  if (!group.total_amount || group.total_amount <= 0) {
    return NextResponse.json(
      { error: "Booking group has no attached seats yet" },
      { status: 400 }
    );
  }

  // 3) Use the service role to flip both the group and its bookings to 'paid'.
  // RLS forbids the user from doing this themselves (correct: payment must be
  // confirmed server-side).
  const service = createServiceSupabase();
  const paidAt = new Date().toISOString();

  const { error: updGroupErr } = await service
    .from("booking_groups")
    .update({
      payment_status: "paid",
      payment_method: "mobile_money",
      payment_reference: `MOCK-${Date.now()}`,
      paid_at: paidAt,
    })
    .eq("id", group.id);

  if (updGroupErr) {
    return NextResponse.json({ error: updGroupErr.message }, { status: 500 });
  }

  const { error: updBookingsErr } = await service
    .from("bookings")
    .update({ payment_status: "paid", payment_method: "mobile_money" })
    .eq("group_id", group.id);

  if (updBookingsErr) {
    return NextResponse.json({ error: updBookingsErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    paid_at: paidAt,
    amount: group.total_amount,
    currency: group.currency,
  });
}

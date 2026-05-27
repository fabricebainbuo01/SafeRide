"use client";

import { getSupabase } from "@/lib/supabase";
import type { LeadKind } from "@/types";

interface LogLeadInput {
  kind: LeadKind;
  /** Booking-group code (when present); not the per-seat booking_code. */
  group_code?: string | null;
  trip_id?: string | null;
  agency_id?: string | null;
  user_id?: string | null;
  /** Free-form payload — typically `{ booking_code, seats, ... }`. */
  metadata?: Record<string, unknown>;
  /**
   * Optional override for the dedup key. By default we dedupe on
   * `${kind}:${group_code ?? metadata.booking_code ?? ""}` so the same lead
   * surface on the same booking only counts once per session-storage window.
   */
  dedupeKey?: string;
}

/** Window during which a repeat (kind, dedupeKey) is treated as the same lead. */
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Fire-and-forget lead logger.
 *
 * Used by every monetisable booking interaction (WhatsApp confirm, PDF
 * download, print, QR scan). Errors are intentionally swallowed — analytics
 * must never break the user flow. Session-storage dedupes naive double-fires
 * (e.g. React 18 StrictMode in dev, double-click on the print button).
 */
export function logLead(input: LogLeadInput): void {
  const client = getSupabase();
  if (!client) return;

  const dedupeBasis =
    input.dedupeKey ??
    input.group_code ??
    (input.metadata?.booking_code as string | undefined) ??
    "";
  const dedupeKey = `lead:${input.kind}:${dedupeBasis}`;

  if (typeof window !== "undefined" && dedupeBasis) {
    const last = Number(sessionStorage.getItem(dedupeKey) ?? 0);
    if (Date.now() - last < DEDUPE_WINDOW_MS) return;
    sessionStorage.setItem(dedupeKey, String(Date.now()));
  }

  void client
    .from("leads_tracking")
    .insert({
      kind: input.kind,
      group_code: input.group_code ?? null,
      trip_id: input.trip_id ?? null,
      agency_id: input.agency_id ?? null,
      user_id: input.user_id ?? null,
      metadata: input.metadata ?? null,
    })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn(`[leads:${input.kind}] insert failed:`, error.message);
      }
    });
}

/**
 * Builds the public ticket URL embedded into the QR code. Adding `?qr=1`
 * lets the ticket page distinguish a counter-staff scan from the passenger
 * loading their own ticket. Falls back to the bare booking code when called
 * during SSR (no `window`), so server-rendered components don't crash.
 */
export function ticketScanUrl(bookingCode: string): string {
  if (typeof window === "undefined") return bookingCode;
  return `${window.location.origin}/ticket/${bookingCode}?qr=1`;
}

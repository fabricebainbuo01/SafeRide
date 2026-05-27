#!/usr/bin/env node
/**
 * Shift all trip departure_date values so the earliest trip lands on today.
 * Use when seed_trips.sql dates have aged out (search returns 0 results).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (RLS blocks anon updates).
 *
 * Usage: node scripts/roll-trip-dates.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function localDateISOString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  console.error("\nOr run this SQL in the Supabase SQL editor:\n");
  console.error(`UPDATE public.trips
SET departure_date = departure_date + (
  CURRENT_DATE - (SELECT MIN(departure_date) FROM public.trips)
)::integer;`);
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const today = localDateISOString();

const { data: minRow, error: minErr } = await sb
  .from("trips")
  .select("departure_date")
  .order("departure_date", { ascending: true })
  .limit(1)
  .maybeSingle();

if (minErr) {
  console.error("Failed to read trips:", minErr.message);
  process.exit(1);
}
if (!minRow?.departure_date) {
  console.log("No trips in database — run supabase/seed_trips.sql first.");
  process.exit(0);
}

const minDate = minRow.departure_date;
if (minDate >= today) {
  console.log(`Trips already current (earliest ${minDate}, today ${today}). Nothing to do.`);
  process.exit(0);
}

const offsetMs =
  new Date(`${today}T12:00:00`).getTime() -
  new Date(`${minDate}T12:00:00`).getTime();
const offsetDays = Math.round(offsetMs / (24 * 60 * 60 * 1000));

console.log(`Shifting ${offsetDays} day(s): earliest ${minDate} → ${today}`);

const { data: allTrips, error: listErr } = await sb
  .from("trips")
  .select("id, departure_date");

if (listErr || !allTrips?.length) {
  console.error("Failed to list trips:", listErr?.message ?? "empty");
  process.exit(1);
}

let updated = 0;
for (const trip of allTrips) {
  const oldDate = new Date(`${trip.departure_date}T12:00:00`);
  oldDate.setDate(oldDate.getDate() + offsetDays);
  const newDate = localDateISOString(oldDate);
  const { error } = await sb
    .from("trips")
    .update({ departure_date: newDate })
    .eq("id", trip.id);
  if (error) {
    console.error(`Failed trip ${trip.id}:`, error.message);
    process.exit(1);
  }
  updated++;
}

const { data: maxRow } = await sb
  .from("trips")
  .select("departure_date")
  .order("departure_date", { ascending: false })
  .limit(1)
  .maybeSingle();

console.log(`Updated ${updated} trip(s). Range is now ${today} … ${maxRow?.departure_date ?? "?"}.`);

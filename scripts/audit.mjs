#!/usr/bin/env node
/**
 * SafeRide repo audit — env alignment, docs presence, migration inventory,
 * internal markdown links, and App Router page discovery (sanity vs README).
 *
 * Usage: node scripts/audit.mjs
 * Exit 0 on success; 1 if any ERROR line is printed.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

let hadError = false;

function error(msg) {
  hadError = true;
  console.error(`ERROR: ${msg}`);
}

function warn(msg) {
  console.warn(`WARN:  ${msg}`);
}

function ok(msg) {
  console.log(`OK     ${msg}`);
}

function info(msg) {
  console.log(`       ${msg}`);
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** Collect route segments for each page.tsx under src/app */
function collectAppRoutes(absDir, parts = []) {
  const out = [];
  if (!fs.existsSync(absDir)) return out;
  for (const name of fs.readdirSync(absDir)) {
    const full = path.join(absDir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      out.push(...collectAppRoutes(full, [...parts, name]));
    } else if (name === "page.tsx") {
      out.push(parts);
    }
  }
  return out;
}

function segmentsToUrl(segments) {
  if (!segments.length) return "/";
  return "/" + segments.join("/");
}

function extractEnvKeysFromEnvTs() {
  const envPath = path.join(ROOT, "src", "lib", "env.ts");
  const src = readText(envPath);
  if (!src) {
    error(`Missing ${path.relative(ROOT, envPath)}`);
    return [];
  }
  const keys = new Set();
  for (const m of src.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) keys.add(m[0]);
  if (src.includes("SUPABASE_SERVICE_ROLE_KEY")) keys.add("SUPABASE_SERVICE_ROLE_KEY");
  return [...keys].sort();
}

function extractEnvExampleKeys() {
  const p = path.join(ROOT, ".env.example");
  const src = readText(p);
  if (!src) {
    error("Missing .env.example");
    return [];
  }
  const keys = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    keys.push(t.slice(0, eq).trim());
  }
  return keys;
}

function checkMarkdownLinks(mdFile) {
  const content = readText(mdFile);
  if (!content) {
    error(`Cannot read ${path.relative(ROOT, mdFile)}`);
    return;
  }
  const dir = path.dirname(mdFile);
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(content))) {
    let href = m[1].trim();
    if (!href || href.startsWith("http://") || href.startsWith("https://"))
      continue;
    if (href.startsWith("mailto:")) continue;
    const hash = href.indexOf("#");
    if (hash >= 0) href = href.slice(0, hash);
    if (!href) continue;
    const target = path.normalize(path.join(dir, href));
    const rel = path.relative(ROOT, target);
    if (!fs.existsSync(target)) {
      error(`Broken link in ${path.relative(ROOT, mdFile)} → "${m[1]}" (resolved ${rel})`);
    }
  }
}

// --- run ---

console.log("SafeRide audit\n");

const envTsKeys = extractEnvKeysFromEnvTs();
const envExampleKeys = extractEnvExampleKeys();

for (const k of envTsKeys) {
  if (!envExampleKeys.includes(k)) {
    warn(`src/lib/env.ts expects "${k}" but .env.example omits it (add a commented or empty line)`);
  }
}
ok(`Environment: ${envTsKeys.length} key(s) tracked in env.ts`);

const readme = path.join(ROOT, "README.md");
const howto = path.join(ROOT, "HOW_TO_CONNECT.md");

for (const f of [readme, howto]) {
  if (!fs.existsSync(f)) error(`Missing ${path.relative(ROOT, f)}`);
  else ok(`Doc present: ${path.relative(ROOT, f)}`);
}

checkMarkdownLinks(readme);
checkMarkdownLinks(howto);

const migDir = path.join(ROOT, "supabase", "migrations");
let migrations = [];
if (fs.existsSync(migDir)) {
  migrations = fs
    .readdirSync(migDir)
    .filter((n) => n.endsWith(".sql"))
    .sort();
}
ok(`Migrations: ${migrations.length} file(s) under supabase/migrations`);
for (const name of migrations) info(name);

const appDir = path.join(ROOT, "src", "app");
const segmentsList = collectAppRoutes(appDir);
const urls = [...new Set(segmentsList.map(segmentsToUrl))].sort();

ok(`App Router: ${urls.length} route(s) with page.tsx`);
info("(sample) " + urls.slice(0, 15).join(", ") + (urls.length > 15 ? ", …" : ""));

const readmeBody = readText(readme) ?? "";
const mustMention = [
  "/admin/routes",
  "/admin/super/routes",
  "/routes",
  "agency_routes",
];
for (const needle of mustMention) {
  if (!readmeBody.includes(needle)) {
    warn(`README.md should mention "${needle}" for alignment with current product`);
  }
}

console.log("");
if (hadError) {
  console.error("Audit finished with ERRORS (exit 1).\n");
  process.exit(1);
}
console.log("Audit finished OK (exit 0).\n");
process.exit(0);

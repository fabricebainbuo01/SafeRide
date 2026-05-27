"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { toastError } from "@/lib/toast";
import type { Agency, City } from "@/types";
import { localDateISOString } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { ArrowRight, Train, Bus } from "lucide-react";

const busRoutes = [
  { from: "Douala", to: "Yaounde", type: "bus" as const },
  { from: "Yaounde", to: "Bafoussam", type: "bus" as const },
  { from: "Douala", to: "Bamenda", type: "bus" as const },
  { from: "Yaounde", to: "Bamenda", type: "bus" as const },
  { from: "Douala", to: "Buea", type: "bus" as const },
  { from: "Buea", to: "Bamenda", type: "bus" as const },
  { from: "Douala", to: "Limbe", type: "bus" as const },
  { from: "Douala", to: "Kumba", type: "bus" as const },
  { from: "Limbe", to: "Yaounde", type: "bus" as const },
  { from: "Buea", to: "Bamenda", type: "bus" as const },
  { from: "Yaounde", to: "Garoua", type: "bus" as const },
  { from: "Yaounde", to: "Maroua", type: "bus" as const },
  { from: "Bafoussam", to: "Ngaoundere", type: "bus" as const },
  { from: "Douala", to: "Nkongsamba", type: "bus" as const },
  { from: "Yaounde", to: "Ebolowa", type: "bus" as const },
  { from: "Douala", to: "Kribi", type: "bus" as const },
];

const camrailRoutes = [
  { from: "Yaounde", to: "Douala", type: "camrail" as const },
  { from: "Douala", to: "Ngaoundere", type: "camrail" as const },
  { from: "Yaounde", to: "Ngaoundere", type: "camrail" as const },
];

const partnerAgenciesFallback = [
  { name: "Amour Mezam", routes: "Bamenda-Yaounde, Bamenda-Douala" },
  { name: "Musango", routes: "Douala-Buea, Limbe-Yaounde, Kumba-Douala" },
  { name: "Moghamo Express", routes: "Multiple inter-urban routes" },
  { name: "Vatican Express", routes: "North and Far North routes" },
  { name: "Oasis Travel", routes: "Centre and Littoral routes" },
];

function routeDedupeKey(kind: "bus" | "camrail", from: string, to: string) {
  return `${kind}:${from.trim().toLowerCase()}:${to.trim().toLowerCase()}`;
}

export default function RoutesPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [agenciesFromDb, setAgenciesFromDb] = useState<Agency[]>([]);
  const [activeTab, setActiveTab] = useState<"bus" | "camrail">("bus");
  const [verifiedDbRoutes, setVerifiedDbRoutes] = useState<
    { kind: "bus" | "camrail"; from: string; to: string }[]
  >([]);
  const [agencyRouteSummaries, setAgencyRouteSummaries] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    async function fetchAll() {
      const client = getSupabase();
      if (!client) return;

      const [{ data: cityRows, error: cityErr }, { data: agencyRows, error: agencyErr }] =
        await Promise.all([
          client.from("cities").select("*").eq("is_active", true).order("name"),
          client
            .from("agencies")
            .select("id, name, slug, city, description, is_active")
            .eq("is_active", true)
            .order("name"),
        ]);

      if (cityErr) toastError(cityErr, "Couldn't load cities");
      else if (cityRows) setCities(cityRows as unknown as City[]);

      if (agencyErr) toastError(agencyErr, "Couldn't load agencies");
      else if (agencyRows) setAgenciesFromDb(agencyRows as unknown as Agency[]);

      const cityById = new Map<string, string>(
        (cityRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
      );

      const { data: routeRows, error: routeErr } = await client
        .from("agency_routes")
        .select("agency_id, route_kind, origin_city_id, destination_city_id")
        .eq("verification_status", "verified")
        .eq("is_active", true);

      if (routeErr) {
        if (!routeErr.message?.includes("agency_routes")) {
          toastError(routeErr, "Couldn't load verified routes");
        }
        setVerifiedDbRoutes([]);
        setAgencyRouteSummaries({});
        return;
      }

      const resolved: { kind: "bus" | "camrail"; from: string; to: string }[] =
        [];
      const summary: Record<string, string[]> = {};
      const seenGlobal = new Set<string>();

      for (const row of routeRows ?? []) {
        const r = row as {
          agency_id: string;
          route_kind: string;
          origin_city_id: string;
          destination_city_id: string;
        };
        const o = cityById.get(r.origin_city_id);
        const d = cityById.get(r.destination_city_id);
        if (!o || !d) continue;
        const kind = r.route_kind === "camrail" ? "camrail" : "bus";
        const gk = routeDedupeKey(kind, o, d);
        if (!seenGlobal.has(gk)) {
          seenGlobal.add(gk);
          resolved.push({ kind, from: o, to: d });
        }

        const line = `${o}–${d}${kind === "camrail" ? " (CAMRAIL)" : ""}`;
        if (!summary[r.agency_id]) summary[r.agency_id] = [];
        const list = summary[r.agency_id]!;
        if (!list.includes(line)) list.push(line);
      }

      setVerifiedDbRoutes(resolved);
      setAgencyRouteSummaries(summary);
    }

    void fetchAll();
  }, []);

  const today = localDateISOString();

  const handleRouteClick = (from: string, to: string) => {
    const originCity = cities.find((c) => c.name === from);
    const destCity = cities.find((c) => c.name === to);
    if (originCity && destCity) {
      router.push(
        `/search?origin=${originCity.id}&destination=${destCity.id}&date=${today}`
      );
    }
  };

  const routeLists = useMemo(() => {
    const keys = new Set(
      verifiedDbRoutes.map((r) => routeDedupeKey(r.kind, r.from, r.to))
    );

    const mergedBus = [
      ...verifiedDbRoutes
        .filter((r) => r.kind === "bus")
        .map((r) => ({ from: r.from, to: r.to, type: "bus" as const })),
      ...busRoutes.filter(
        (r) => !keys.has(routeDedupeKey("bus", r.from, r.to))
      ),
    ];

    const mergedCamrail = [
      ...verifiedDbRoutes
        .filter((r) => r.kind === "camrail")
        .map((r) => ({ from: r.from, to: r.to, type: "camrail" as const })),
      ...camrailRoutes.filter(
        (r) => !keys.has(routeDedupeKey("camrail", r.from, r.to))
      ),
    ];

    return { mergedBus, mergedCamrail };
  }, [verifiedDbRoutes]);

  const displayRoutes =
    activeTab === "bus" ? routeLists.mergedBus : routeLists.mergedCamrail;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-navy-800 mb-2">Routes</h1>
      <p className="text-navy-500 mb-8">
        Click a route to search for available trips. Listings combine verified
        corridors from partner agencies with default coverage when agencies have
        not published a route yet. CAMRAIL passenger routes are included on the
        CAMRAIL tab.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-navy-200">
        <button
          type="button"
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "bus"
              ? "text-primary-700 border-primary-700"
              : "text-navy-500 border-transparent hover:text-navy-700"
          }`}
          onClick={() => setActiveTab("bus")}
        >
          <Bus size={16} />
          Bus Routes ({routeLists.mergedBus.length})
        </button>
        <button
          type="button"
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "camrail"
              ? "text-primary-700 border-primary-700"
              : "text-navy-500 border-transparent hover:text-navy-700"
          }`}
          onClick={() => setActiveTab("camrail")}
        >
          <Train size={16} />
          CAMRAIL Routes ({routeLists.mergedCamrail.length})
        </button>
      </div>

      {/* Route Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
        {displayRoutes.map((route, idx) => (
          <button
            key={`${route.from}-${route.to}-${route.type}-${idx}`}
            type="button"
            className="p-4 bg-white border border-navy-200 hover:border-primary-700 transition-colors text-left"
            onClick={() => handleRouteClick(route.from, route.to)}
          >
            <p className="font-semibold text-navy-800 text-sm">{route.from}</p>
            <div className="flex items-center gap-2 my-1">
              <div className="h-px flex-1 bg-navy-300" />
              <ArrowRight size={12} className="text-navy-400" />
            </div>
            <p className="font-semibold text-navy-800 text-sm">{route.to}</p>
            {route.type === "camrail" && (
              <span className="inline-block mt-2 text-xs font-medium text-action-700 bg-action-50 px-2 py-0.5">
                CAMRAIL
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Partner Agencies — from DB when seed_agencies.sql has been applied */}
      <h2 className="text-2xl font-bold text-navy-800 mb-6">Partner Agencies</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agenciesFromDb.length > 0
          ? agenciesFromDb.map((agency) => {
              const lines = agencyRouteSummaries[agency.id];
              const extra =
                lines && lines.length > 0
                  ? lines.slice(0, 6).join("; ") +
                    (lines.length > 6 ? ` (+${lines.length - 6} more)` : "")
                  : agency.description?.trim() ||
                    "Inter-urban routes across Cameroon.";
              return (
                <Card key={agency.id}>
                  <h3 className="font-semibold text-navy-800 mb-1">{agency.name}</h3>
                  <p className="text-xs text-navy-400 mb-2">{agency.city}</p>
                  <p className="text-sm text-navy-500">{extra}</p>
                </Card>
              );
            })
          : partnerAgenciesFallback.map((agency) => (
              <Card key={agency.name}>
                <h3 className="font-semibold text-navy-800 mb-1">{agency.name}</h3>
                <p className="text-sm text-navy-500">{agency.routes}</p>
              </Card>
            ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import type { City } from "@/types";
import { ArrowRight, Train, Bus } from "lucide-react";

const busRoutes = [
  { from: "Douala", to: "Yaounde", type: "bus" },
  { from: "Yaounde", to: "Bafoussam", type: "bus" },
  { from: "Douala", to: "Bamenda", type: "bus" },
  { from: "Yaounde", to: "Bamenda", type: "bus" },
  { from: "Douala", to: "Buea", type: "bus" },
  { from: "Buea", to: "Bamenda", type: "bus" },
  { from: "Douala", to: "Limbe", type: "bus" },
  { from: "Douala", to: "Kumba", type: "bus" },
  { from: "Limbe", to: "Yaounde", type: "bus" },
  { from: "Buea", to: "Bamenda", type: "bus" },
  { from: "Yaounde", to: "Garoua", type: "bus" },
  { from: "Yaounde", to: "Maroua", type: "bus" },
  { from: "Bafoussam", to: "Ngaoundere", type: "bus" },
  { from: "Douala", to: "Nkongsamba", type: "bus" },
  { from: "Yaounde", to: "Ebolowa", type: "bus" },
  { from: "Douala", to: "Kribi", type: "bus" },
];

const camrailRoutes = [
  { from: "Yaounde", to: "Douala", type: "camrail" },
  { from: "Douala", to: "Ngaoundere", type: "camrail" },
  { from: "Yaounde", to: "Ngaoundere", type: "camrail" },
];

const partnerAgencies = [
  { name: "Amour Mezam", routes: "Bamenda-Yaounde, Bamenda-Douala" },
  { name: "Musango", routes: "Douala-Buea, Limbe-Yaounde, Kumba-Douala" },
  { name: "Moghamo Express", routes: "Multiple inter-urban routes" },
  { name: "Vatican Express", routes: "North and Far North routes" },
  { name: "Oasis Travel", routes: "Centre and Littoral routes" },
];

export default function RoutesPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [activeTab, setActiveTab] = useState<"bus" | "camrail">("bus");

  useEffect(() => {
    async function fetchCities() {
      const { data } = await supabase
        .from("cities")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (data) setCities(data);
    }
    fetchCities();
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const handleRouteClick = (from: string, to: string) => {
    const originCity = cities.find((c) => c.name === from);
    const destCity = cities.find((c) => c.name === to);
    if (originCity && destCity) {
      router.push(
        `/search?origin=${originCity.id}&destination=${destCity.id}&date=${today}`
      );
    }
  };

  const displayRoutes =
    activeTab === "bus" ? busRoutes : camrailRoutes;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-navy-800 mb-2">Routes</h1>
      <p className="text-navy-500 mb-8">
        Click a route to search for available trips. We cover bus routes and
        CAMRAIL passenger routes across Cameroon.
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
          Bus Routes ({busRoutes.length})
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
          CAMRAIL Routes ({camrailRoutes.length})
        </button>
      </div>

      {/* Route Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
        {displayRoutes.map((route, idx) => (
          <button
            key={`${route.from}-${route.to}-${idx}`}
            type="button"
            className="p-4 bg-white border border-navy-200 hover:border-primary-700 transition-colors text-left"
            onClick={() => handleRouteClick(route.from, route.to)}
          >
            <p className="font-semibold text-navy-800 text-sm">
              {route.from}
            </p>
            <div className="flex items-center gap-2 my-1">
              <div className="h-px flex-1 bg-navy-300" />
              <ArrowRight size={12} className="text-navy-400" />
            </div>
            <p className="font-semibold text-navy-800 text-sm">
              {route.to}
            </p>
            {route.type === "camrail" && (
              <span className="inline-block mt-2 text-xs font-medium text-action-700 bg-action-50 px-2 py-0.5">
                CAMRAIL
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Partner Agencies */}
      <h2 className="text-2xl font-bold text-navy-800 mb-6">
        Partner Agencies
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {partnerAgencies.map((agency) => (
          <Card key={agency.name}>
            <h3 className="font-semibold text-navy-800 mb-1">{agency.name}</h3>
            <p className="text-sm text-navy-500">{agency.routes}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

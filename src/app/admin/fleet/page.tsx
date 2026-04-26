"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { Bus } from "@/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function FleetPage() {
  const router = useRouter();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  const [plateNumber, setPlateNumber] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [rows, setRows] = useState("4");
  const [cols, setCols] = useState("4");
  const [aisleAfter, setAisleAfter] = useState("2");

  const fetchBuses = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) { router.push("/auth/login"); return; }

    const { data: userData } = await supabase
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .single();

    if (!userData?.agency_id) return;

    const { data } = await supabase
      .from("buses")
      .select("*")
      .eq("agency_id", userData.agency_id)
      .order("created_at", { ascending: false });

    if (data) setBuses(data as unknown as Bus[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchBuses();
  }, [fetchBuses]);

  const resetForm = () => {
    setPlateNumber("");
    setModel("");
    setCapacity("");
    setRows("4");
    setCols("4");
    setAisleAfter("2");
    setEditingBus(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .single();

    if (!userData?.agency_id) return;

    const seatLayout = {
      rows: parseInt(rows),
      cols: parseInt(cols),
      aisleAfter: parseInt(aisleAfter),
      unavailable: [],
    };

    if (editingBus) {
      await supabase
        .from("buses")
        .update({
          plate_number: plateNumber,
          model,
          capacity: parseInt(capacity),
          seat_layout: seatLayout,
        })
        .eq("id", editingBus.id);
    } else {
      await supabase.from("buses").insert({
        agency_id: userData.agency_id,
        plate_number: plateNumber,
        model,
        capacity: parseInt(capacity),
        seat_layout: seatLayout,
      });
    }

    resetForm();
    fetchBuses();
  };

  const handleToggleActive = async (bus: Bus) => {
    await supabase
      .from("buses")
      .update({ is_active: !bus.is_active })
      .eq("id", bus.id);
    fetchBuses();
  };

  const startEdit = (bus: Bus) => {
    setEditingBus(bus);
    setPlateNumber(bus.plate_number);
    setModel(bus.model);
    setCapacity(bus.capacity.toString());
    setRows(bus.seat_layout.rows.toString());
    setCols(bus.seat_layout.cols.toString());
    setAisleAfter(bus.seat_layout.aisleAfter.toString());
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <div className="animate-pulse-slow space-y-4">
            <div className="h-8 w-48 bg-navy-100" />
            <div className="h-32 bg-navy-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-navy-800">Fleet Management</h1>
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} className="mr-2" />
            Add Bus
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingBus ? "Edit Bus" : "Add New Bus"}</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Plate Number"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                id="plate"
                placeholder="e.g. LT-123-AB"
              />
              <Input
                label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                id="model"
                placeholder="e.g. Coaster 30-Seater"
              />
              <Input
                label="Capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                id="capacity"
                placeholder="e.g. 30"
              />
              <Input
                label="Seat Rows"
                type="number"
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                id="rows"
              />
              <Input
                label="Seat Columns"
                type="number"
                value={cols}
                onChange={(e) => setCols(e.target.value)}
                id="cols"
              />
              <Input
                label="Aisle After Column"
                type="number"
                value={aisleAfter}
                onChange={(e) => setAisleAfter(e.target.value)}
                id="aisle"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={handleSave}>
                {editingBus ? "Update Bus" : "Add Bus"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {buses.length === 0 ? (
          <Card>
            <p className="text-center text-navy-500 text-sm">
              No buses in your fleet. Add your first bus above.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {buses.map((bus) => (
              <Card key={bus.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-navy-800">
                      {bus.plate_number}
                    </h3>
                    <Badge variant={bus.is_active ? "success" : "danger"}>
                      {bus.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-navy-500">
                    {bus.model} - {bus.capacity} seats | Layout: {bus.seat_layout.rows}x{bus.seat_layout.cols} (aisle after col {bus.seat_layout.aisleAfter})
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(bus)}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant={bus.is_active ? "danger" : "primary"}
                    size="sm"
                    onClick={() => handleToggleActive(bus)}
                  >
                    {bus.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

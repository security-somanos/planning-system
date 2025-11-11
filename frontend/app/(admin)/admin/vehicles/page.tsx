'use client';
import { useEffect, useState } from "react";
import { AdminLayout } from "../../../../components/layout/AdminLayout";
import { mockApi } from "../../../../lib/mockApi";
import { Vehicle, Location } from "../../../../lib/types";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Modal } from "../../../../components/ui/Modal";

export default function VehicleManagerPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Partial<Vehicle>>({});

  useEffect(() => {
    refresh();
    mockApi
      .get<{ items: Location[] }>("/locations")
      .then((res) => setLocations(res.items))
      .catch(() => {});
  }, []);

  const refresh = () => {
    setLoading(true);
    mockApi
      .get<{ items: Vehicle[] }>("/vehicles")
      .then((res) => setVehicles(res.items))
      .catch(() => setError("Failed to load vehicles."))
      .finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ label: "", make: "", model: "", licensePlate: "", capacity: undefined, availableFrom: "", availableTo: "", originationLocationId: undefined, notes: "" });
    setModalOpen(true);
  };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ 
      label: v.label, 
      make: v.make, 
      model: v.model, 
      licensePlate: v.licensePlate, 
      capacity: v.capacity, 
      availableFrom: v.availableFrom, 
      availableTo: v.availableTo, 
      originationLocationId: v.originationLocationId, 
      notes: v.notes 
    });
    setModalOpen(true);
  };
  const saveForm = async () => {
    if (editing) {
      await mockApi.put(`/vehicles/${editing.id}`, form);
    } else {
      await mockApi.post("/vehicles", form);
    }
    setModalOpen(false);
    refresh();
  };
  const remove = async (v: Vehicle) => {
    if (!confirm(`Delete vehicle "${v.label}"?`)) return;
    await mockApi.delete(`/vehicles/${v.id}`);
    refresh();
  };

  return (
    <AdminLayout title="Vehicle Manager">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Vehicles</div>
        <Button onClick={openCreate}>Add vehicle</Button>
      </div>
      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{v.label}</div>
                <div className="text-xs text-zinc-600">
                  {[v.make, v.model].filter(Boolean).join(" ") || "—"} • {v.licensePlate || "No plate"} • {v.capacity ? `${v.capacity} seats` : "—"}
                  {v.availableFrom && v.availableTo && ` • Available: ${v.availableFrom} - ${v.availableTo}`}
                  {v.originationLocationId && (() => {
                    const loc = locations.find((l) => l.id === v.originationLocationId);
                    return loc ? ` • Origination: ${loc.name}` : "";
                  })()}
                </div>
                {v.notes && <div className="text-xs text-zinc-500 mt-1">{v.notes}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => openEdit(v)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(v)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit vehicle" : "Add vehicle"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm}>{editing ? "Save changes" : "Create"}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Label *</div>
            <Input value={form.label ?? ""} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g., Car 1, Van A" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Make</div>
            <Input value={form.make ?? ""} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} placeholder="e.g., Toyota" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Model</div>
            <Input value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g., Camry" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">License Plate</div>
            <Input value={form.licensePlate ?? ""} onChange={(e) => setForm((f) => ({ ...f, licensePlate: e.target.value }))} placeholder="e.g., ABC-123" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Capacity</div>
            <Input type="number" value={form.capacity ?? ""} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="Number of seats" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Available From</div>
            <Input type="time" value={form.availableFrom ?? ""} onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))} placeholder="HH:mm" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Available To</div>
            <Input type="time" value={form.availableTo ?? ""} onChange={(e) => setForm((f) => ({ ...f, availableTo: e.target.value }))} placeholder="HH:mm" />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Origination Location</div>
            <Select
              value={form.originationLocationId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, originationLocationId: e.target.value || undefined }))}
            >
              <option value="">No origination location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Notes</div>
            <Input value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}


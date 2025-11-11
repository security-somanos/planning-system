'use client';
import { useEffect, useState } from "react";
import { AdminLayout } from "../../../../components/layout/AdminLayout";
import { mockApi } from "../../../../lib/mockApi";
import { Location } from "../../../../lib/types";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Modal } from "../../../../components/ui/Modal";

export default function LocationManagerPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<Partial<Location>>({});

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    setLoading(true);
    mockApi
      .get<{ items: Location[] }>("/locations")
      .then((res) => setLocations(res.items))
      .catch(() => setError("Failed to load locations."))
      .finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", type: "generic", address: "", googleMapsLink: "" });
    setModalOpen(true);
  };
  const openEdit = (l: Location) => {
    setEditing(l);
    setForm({ name: l.name, type: l.type, address: l.address, googleMapsLink: l.googleMapsLink });
    setModalOpen(true);
  };
  const saveForm = async () => {
    if (editing) {
      await mockApi.put(`/locations/${editing.id}`, form);
    } else {
      await mockApi.post("/locations", form);
    }
    setModalOpen(false);
    refresh();
  };
  const remove = async (l: Location) => {
    if (!confirm("Delete this location? It will be unlinked from blocks.")) return;
    await mockApi.delete(`/locations/${l.id}`);
    refresh();
  };

  return (
    <AdminLayout title="Location Manager">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Locations</div>
        <Button onClick={openCreate}>Add location</Button>
      </div>
      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {locations.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="text-xs text-zinc-600">{l.type}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => openEdit(l)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(l)}>
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
        title={editing ? "Edit location" : "Add location"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm}>{editing ? "Save changes" : "Create"}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <div>
            <div className="mb-1 text-sm font-medium">Name</div>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Type</div>
            <Select value={form.type ?? "generic"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}>
              <option value="venue">venue</option>
              <option value="hotel">hotel</option>
              <option value="restaurant">restaurant</option>
              <option value="generic">generic</option>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Address</div>
            <Input
              value={form.address ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Google Maps Link</div>
            <Input
              value={form.googleMapsLink ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, googleMapsLink: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}



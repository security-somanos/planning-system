'use client';
import { useEffect, useState } from "react";
import { AdminLayout } from "../../../../components/layout/AdminLayout";
import { mockApi } from "../../../../lib/mockApi";
import { Location, Participant } from "../../../../lib/types";
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
  const [contacts, setContacts] = useState<string[]>(['']);
  const [selectedSiteManagers, setSelectedSiteManagers] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [siteManagerSearchQuery, setSiteManagerSearchQuery] = useState("");
  const [siteManagerInputFocused, setSiteManagerInputFocused] = useState(false);

  useEffect(() => {
    refresh();
    loadParticipants();
  }, []);

  const loadParticipants = () => {
    mockApi
      .get<{ items: Participant[] }>("/participants")
      .then((res) => setParticipants(res.items))
      .catch(() => {});
  };

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
    setContacts(['']);
    setSelectedSiteManagers([]);
    setSiteManagerSearchQuery("");
    setSiteManagerInputFocused(false);
    setModalOpen(true);
  };
  const openEdit = (l: Location) => {
    setEditing(l);
    setForm({ name: l.name, type: l.type, address: l.address, googleMapsLink: l.googleMapsLink });
    setContacts(l.contact && l.contact.length > 0 ? l.contact : ['']);
    setSelectedSiteManagers(l.siteManagerIds || []);
    setSiteManagerSearchQuery("");
    setSiteManagerInputFocused(false);
    setModalOpen(true);
  };
  const saveForm = async () => {
    const payload: any = {
      name: form.name,
      type: form.type,
      address: form.address,
      googleMapsLink: form.googleMapsLink,
      contact: contacts.filter(c => c.trim() !== ''),
      siteManagerIds: selectedSiteManagers.length > 0 ? selectedSiteManagers : undefined,
    };
    
    if (editing) {
      await mockApi.put(`/locations/${editing.id}`, payload);
    } else {
      await mockApi.post("/locations", payload);
    }
    setModalOpen(false);
    refresh();
  };
  const remove = async (l: Location) => {
    if (!confirm("Delete this location? It will be unlinked from events.")) return;
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
          {locations.map((l) => {
            const siteManagers = l.siteManagerIds?.map(id => participants.find(p => p.id === id)?.name).filter(Boolean) || [];
            return (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="text-xs text-zinc-600">{l.type}</div>
                  {l.contact && l.contact.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-500">
                      Contact: {l.contact.join(", ")}
                    </div>
                  )}
                  {siteManagers.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-500">
                      Site Managers: {siteManagers.join(", ")}
                    </div>
                  )}
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
            );
          })}
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
          <div>
            <div className="mb-1 text-sm font-medium">Contact Information</div>
            <div className="space-y-2">
              {contacts.map((contact, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={contact}
                    onChange={(e) => {
                      const updated = [...contacts];
                      updated[idx] = e.target.value;
                      setContacts(updated);
                    }}
                    placeholder="Phone, email, etc."
                  />
                  {contacts.length > 1 && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setContacts([...contacts, ''])}
              >
                + Add Contact
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Site Managers</div>
            <div className="space-y-2">
              {selectedSiteManagers.length > 0 && (
                <div className="space-y-2">
                  {selectedSiteManagers.map((id) => {
                    const participant = participants.find(p => p.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between rounded border border-zinc-200 bg-white p-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-zinc-900">{participant?.name || id}</div>
                          {participant?.email && (
                            <div className="text-xs text-zinc-600">{participant.email}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSiteManagers(selectedSiteManagers.filter(sid => sid !== id));
                          }}
                          className="ml-2 p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Remove"
                        >
                          <span className="text-red-600 text-sm">✕</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <Input
                  value={siteManagerSearchQuery}
                  onChange={(e) => setSiteManagerSearchQuery(e.target.value)}
                  onFocus={() => {
                    setSiteManagerInputFocused(true);
                    setSiteManagerSearchQuery("");
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setSiteManagerInputFocused(false), 200);
                  }}
                  placeholder="Search and add site managers..."
                />
                {siteManagerInputFocused && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-zinc-200 bg-white shadow-lg">
                    {(() => {
                      const availableManagers = participants.filter(
                        (p) => 
                          p.roles?.includes("Advanced team members (on Site manager)") &&
                          !selectedSiteManagers.includes(p.id)
                      );
                      const filteredManagers = siteManagerSearchQuery.trim().length > 0
                        ? availableManagers.filter((p) =>
                            p.name.toLowerCase().includes(siteManagerSearchQuery.toLowerCase())
                          )
                        : availableManagers;

                      return filteredManagers.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">No site managers found</div>
                      ) : (
                        filteredManagers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedSiteManagers([...selectedSiteManagers, p.id]);
                              setSiteManagerSearchQuery("");
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 cursor-pointer"
                          >
                            {p.name}
                          </button>
                        ))
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}



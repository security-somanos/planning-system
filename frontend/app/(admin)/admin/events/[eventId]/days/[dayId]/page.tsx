'use client';
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { mockApi } from "@/lib/mockApi";
import { Block, BlockType, Day, Location, Participant } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

function BlockBadge({ type }: { type: BlockType }) {
  const cls =
    type === "activity"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : type === "movement"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs ${cls}`}>{type}</span>;
}

type BlockFormState = {
  id?: string;
  type: BlockType;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  locationId?: string;
  locationStartId?: string;
  locationEndId?: string;
  participantsIds: string[];
  attachmentsText: string; // comma separated
  notes?: string;
};

function emptyForm(): BlockFormState {
  return {
    type: "activity",
    title: "",
    description: "",
    startTime: "09:00",
    endTime: "10:00",
    locationId: undefined,
    locationStartId: undefined,
    locationEndId: undefined,
    participantsIds: [],
    attachmentsText: "",
    notes: "",
  };
}

export default function DayEditorPage() {
  const params = useParams<{ eventId: string; dayId: string }>();
  const eventId = params.eventId;
  const dayId = params.dayId;

  const [day, setDay] = useState<Day | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<BlockFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      mockApi.get<{ item: Day }>(`/events/${eventId}/days/${dayId}`),
      mockApi.get<{ items: Participant[] }>("/participants"),
      mockApi.get<{ items: Location[] }>("/locations"),
    ])
      .then(([d, p, l]) => {
        if (!mounted) return;
        setDay(d.item);
        setParticipants(p.items);
        setLocations(l.items);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Failed to load day.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [eventId, dayId]);

  const participantById = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const p of participants) map.set(p.id, p);
    return map;
  }, [participants]);

  const locationById = useMemo(() => {
    const map = new Map<string, Location>();
    for (const l of locations) map.set(l.id, l);
    return map;
  }, [locations]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (b: Block) => {
    setEditingId(b.id);
    setForm({
      id: b.id,
      type: b.type,
      title: b.title,
      description: b.description,
      startTime: b.startTime,
      endTime: b.endTime,
      locationId: b.locationId,
      locationStartId: b.locationStartId,
      locationEndId: b.locationEndId,
      participantsIds: b.participantsIds,
      attachmentsText: b.attachments?.join(", ") ?? "",
      notes: b.notes,
    });
    setModalOpen(true);
  };

  const saveForm = async () => {
    const payload = {
      type: form.type,
      title: form.title,
      description: form.description,
      startTime: form.startTime,
      endTime: form.endTime,
      locationId: form.type !== "movement" ? form.locationId : undefined,
      locationStartId: form.type === "movement" ? form.locationStartId : undefined,
      locationEndId: form.type === "movement" ? form.locationEndId : undefined,
      participantsIds: form.participantsIds,
      attachments: form.attachmentsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: form.notes,
    };
    if (!day) return;
    if (editingId) {
      await mockApi.put(`/events/${eventId}/days/${dayId}/blocks/${editingId}`, payload);
      // refresh day
      const updated = await mockApi.get<{ item: Day }>(`/events/${eventId}/days/${dayId}`);
      setDay(updated.item);
    } else {
      await mockApi.post(`/events/${eventId}/days/${dayId}/blocks`, payload);
      const updated = await mockApi.get<{ item: Day }>(`/events/${eventId}/days/${dayId}`);
      setDay(updated.item);
    }
    setModalOpen(false);
  };

  const deleteBlock = async (id: string) => {
    if (!confirm("Delete this block?")) return;
    await mockApi.delete(`/events/${eventId}/days/${dayId}/blocks/${id}`);
    const updated = await mockApi.get<{ item: Day }>(`/events/${eventId}/days/${dayId}`);
    setDay(updated.item);
  };

  const moveBlock = async (index: number, dir: -1 | 1) => {
    if (!day || !day.blocks) return;
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= day.blocks.length) return;
    const order = [...day.blocks.map((b) => b.id)];
    const [moved] = order.splice(index, 1);
    order.splice(nextIdx, 0, moved);
    await mockApi.post(`/events/${eventId}/days/${dayId}/blocks/reorder`, { order });
    const updated = await mockApi.get<{ item: Day }>(`/events/${eventId}/days/${dayId}`);
    setDay(updated.item);
  };

  return (
    <AdminLayout title={`Day ${day?.date ?? ""}`}>
      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : !day ? (
        <div className="text-sm text-red-600">Day not found.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-600">Event day</div>
              <div className="text-lg font-semibold">{day.date}</div>
            </div>
            <Button onClick={openCreate}>Add block</Button>
          </div>

          <div className="space-y-3">
            {!day.blocks || day.blocks.length === 0 ? (
              <div className="text-sm text-zinc-600">No blocks yet.</div>
            ) : (
              day.blocks.map((b, idx) => (
                <div key={b.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{b.title}</div>
                        <BlockBadge type={b.type} />
                      </div>
                      <div className="text-xs text-zinc-600">
                        {b.startTime}–{b.endTime}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => moveBlock(idx, -1)}>
                        ↑
                      </Button>
                      <Button variant="secondary" onClick={() => moveBlock(idx, 1)}>
                        ↓
                      </Button>
                      <Button variant="secondary" onClick={() => openEdit(b)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => deleteBlock(b.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-700">{b.description}</div>
                  <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    {b.type === "movement" ? (
                      <>
                        <div>
                          <div className="text-xs text-zinc-500">From</div>
                          <div>{b.locationStartId ? locationById.get(b.locationStartId)?.name : "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">To</div>
                          <div>{b.locationEndId ? locationById.get(b.locationEndId)?.name : "-"}</div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <div className="text-xs text-zinc-500">Location</div>
                        <div>{b.locationId ? locationById.get(b.locationId)?.name : "-"}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-zinc-500">Participants</div>
                      <div className="truncate">
                        {b.participantsIds.map((pid) => participantById.get(pid)?.name).filter(Boolean).join(", ") ||
                          "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit block" : "Add block"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm}>{editingId ? "Save changes" : "Create block"}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-medium">Type</div>
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as BlockType }))
                }
              >
                <option value="activity">Activity</option>
                <option value="movement">Movement</option>
                <option value="break">Break</option>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Title</div>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-sm font-medium">Start time</div>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">End time</div>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Description</div>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          {form.type === "movement" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-medium">From</div>
                <Select
                  value={form.locationStartId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, locationStartId: e.target.value || undefined }))}
                >
                  <option value="">Select…</option>
                  {locations.map((l) => (
                    <option value={l.id} key={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">To</div>
                <Select
                  value={form.locationEndId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, locationEndId: e.target.value || undefined }))}
                >
                  <option value="">Select…</option>
                  {locations.map((l) => (
                    <option value={l.id} key={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-sm font-medium">Location</div>
              <Select
                value={form.locationId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value || undefined }))}
              >
                <option value="">Select…</option>
                {locations.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <div className="mb-1 text-sm font-medium">Participants</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {participants.map((p) => {
                const checked = form.participantsIds.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 rounded border border-zinc-200 p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setForm((f) => {
                          const s = new Set(f.participantsIds);
                          if (isChecked) s.add(p.id);
                          else s.delete(p.id);
                          return { ...f, participantsIds: Array.from(s) };
                        });
                      }}
                    />
                    <span className="text-sm">
                      {p.name}{" "}
                      <span className="text-xs text-zinc-600">
                        ({Array.isArray((p as any).roles) && (p as any).roles.length ? (p as any).roles.join(", ") : "—"})
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Attachments (comma separated)</div>
            <Input
              value={form.attachmentsText}
              onChange={(e) => setForm((f) => ({ ...f, attachmentsText: e.target.value }))}
              placeholder="e.g. brochure.pdf, map.png"
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Notes</div>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}



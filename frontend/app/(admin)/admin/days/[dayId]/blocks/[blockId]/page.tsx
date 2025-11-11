'use client';
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { mockApi } from "@/lib/mockApi";
import { Block, BlockType, Day, Location, Participant, ScheduleItem } from "@/lib/types";
import { PARTICIPANT_ROLES } from "@/lib/constants";
import { generateId } from "@/lib/id";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

type BlockFormState = {
  id?: string;
  type: BlockType;
  title: string;
  description?: string;
  startTime: string;
  endTime: string | null;
  endTimeFixed?: boolean;
  locationId?: string;
  participantsIds: string[];
  advanceParticipantIds: string[];
  metByParticipantIds: string[];
  attachmentsText: string;
  notes?: string;
  scheduleItems: ScheduleItem[];
};

function emptyForm(): BlockFormState {
  return {
    type: "activity",
    title: "",
    description: "",
    startTime: "09:00",
    endTime: null,
    endTimeFixed: false, // Default to auto end time
    locationId: undefined,
    participantsIds: [],
    advanceParticipantIds: [],
    metByParticipantIds: [],
    attachmentsText: "",
    notes: "",
    scheduleItems: [],
  };
}

function calculateEndTimeFromScheduleItems(scheduleItems: ScheduleItem[]): string | null {
  if (scheduleItems.length === 0) return null;
  const latest = scheduleItems.reduce((latest, item) => {
    return item.time > latest.time ? item : latest;
  }, scheduleItems[0]);
  return latest.time;
}

export default function BlockEditorPage() {
  const params = useParams<{ dayId: string; blockId: string }>();
  const router = useRouter();
  const dayId = params.dayId;
  const blockId = params.blockId;
  const isNew = blockId === "new";

  const [day, setDay] = useState<Day | null>(null);
  const [block, setBlock] = useState<Block | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<BlockFormState>(emptyForm());
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [newLocationOpen, setNewLocationOpen] = useState<false | "locationId">(false);
  const [newLocationForm, setNewLocationForm] = useState<{ name: string; type: Location["type"]; address?: string; googleMapsLink?: string }>({
    name: "",
    type: "generic",
    address: "",
    googleMapsLink: "",
  });
  const [newParticipantOpen, setNewParticipantOpen] = useState(false);
  const [newParticipantForm, setNewParticipantForm] = useState<Partial<Participant>>({
    name: "",
    roles: [],
    email: "",
    phone: "",
  });
  const [participantQuery, setParticipantQuery] = useState("");
  const [advanceParticipantQuery, setAdvanceParticipantQuery] = useState("");
  const [metByParticipantQuery, setMetByParticipantQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      mockApi.get<{ item: Day }>(`/days/${dayId}`),
      mockApi.get<{ items: Participant[] }>("/participants"),
      mockApi.get<{ items: Location[] }>("/locations"),
    ])
      .then(([d, p, l]) => {
        if (!mounted) return;
        setDay(d.item);
        setParticipants(p.items);
        setLocations(l.items);
        if (!isNew) {
          const foundBlock = d.item.blocks?.find((b) => b.id === blockId);
          if (foundBlock) {
            setBlock(foundBlock);
            setForm({
              id: foundBlock.id,
              type: foundBlock.type,
              title: foundBlock.title,
              description: foundBlock.description,
              startTime: foundBlock.startTime,
              endTime: foundBlock.endTime ?? null,
              endTimeFixed: foundBlock.endTimeFixed === true, // Default to false (auto) if not set
              locationId: foundBlock.locationId,
              participantsIds: foundBlock.participantsIds || [],
              advanceParticipantIds: foundBlock.advanceParticipantIds || [],
              metByParticipantIds: foundBlock.metByParticipantIds || [],
              attachmentsText: foundBlock.attachments?.join(", ") ?? "",
              notes: foundBlock.notes,
              scheduleItems: foundBlock.scheduleItems || [],
            });
            const mapped = (foundBlock.attachments || []).map((u) => {
              try {
                const url = new URL(u);
                const nameGuess = url.pathname.split("/").pop() || "attachment";
                return { name: nameGuess, url: u };
              } catch {
                return { name: "attachment", url: u };
              }
            });
            setAttachments(mapped);
          } else {
            setError("Block not found.");
          }
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError("Failed to load data.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [dayId, blockId, isNew]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onFilesChosen(files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onFilesChosen = (files: FileList | File[]) => {
    const newAttachments = Array.from(files).map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  const createLocation = async () => {
    if (!newLocationForm.name) return;
    const res = await mockApi.post<{ item: Location }>("/locations", newLocationForm);
    setLocations((prev) => [...prev, res.item]);
    if (newLocationOpen === "locationId") {
      setForm((f) => ({ ...f, locationId: res.item.id }));
    }
    setNewLocationOpen(false);
    setNewLocationForm({ name: "", type: "generic", address: "", googleMapsLink: "" });
  };

  const createParticipant = async () => {
    if (!newParticipantForm.name) return;
    const res = await mockApi.post<{ item: Participant }>("/participants", newParticipantForm);
    setParticipants((prev) => [...prev, res.item]);
    setForm((f) => ({ ...f, participantsIds: [...f.participantsIds, res.item.id] }));
    setNewParticipantOpen(false);
    setNewParticipantForm({ name: "", roles: [], email: "", phone: "" });
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title,
        description: form.description,
        startTime: form.startTime,
        endTime: form.endTimeFixed === false ? (calculateEndTimeFromScheduleItems(form.scheduleItems) ?? form.endTime) : (form.endTime ?? ""),
        endTimeFixed: form.endTimeFixed === true, // Save as false (auto) if not explicitly true
        locationId: form.locationId,
        participantsIds: form.participantsIds,
        advanceParticipantIds: form.advanceParticipantIds,
        metByParticipantIds: form.metByParticipantIds,
        attachments:
          attachments.length > 0
            ? attachments.map((a) => a.url)
            : form.attachmentsText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
        notes: form.notes,
        scheduleItems: form.scheduleItems,
      };
      if (isNew) {
        await mockApi.post(`/days/${dayId}/blocks`, payload);
      } else {
        await mockApi.put(`/days/${dayId}/blocks/${blockId}`, payload);
      }
      router.push(`/admin/days/${dayId}`);
    } catch (err) {
      setError("Failed to save block.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title={isNew ? "New Block" : "Edit Block"}>
        <div className="text-sm text-zinc-600">Loading…</div>
      </AdminLayout>
    );
  }

  if (error && !isNew && !block) {
    return (
      <AdminLayout title="Error">
        <div className="text-sm text-red-600">{error}</div>
        <Link href={`/admin/days/${dayId}`}>
          <Button variant="secondary" className="mt-4">Back to Day</Button>
        </Link>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={isNew ? "New Block" : `Edit Block: ${block?.title ?? ""}`}>
      <div className="mb-4">
        <Link href={`/admin/days/${dayId}`}>
          <Button variant="secondary">← Back to Day</Button>
        </Link>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-sm font-medium">Type</div>
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as BlockType }))}
            >
              <option value="activity">Activity</option>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-sm font-medium">Start time</div>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">End time</span>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={form.endTimeFixed === true}
                  onChange={(e) => {
                    const fixed = e.target.checked;
                    setForm((f) => ({
                      ...f,
                      endTimeFixed: fixed,
                      // If enabling auto, calculate from schedule items (or keep current if not calculable)
                      endTime: fixed ? (f.endTime ?? "") : (calculateEndTimeFromScheduleItems(f.scheduleItems) ?? f.endTime ?? ""),
                    }));
                  }}
                  className="cursor-pointer"
                />
                <span>Fixed end time</span>
              </label>
            </div>
            {form.endTimeFixed === false ? (
              <div className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                {(() => {
                  const autoEndTime = calculateEndTimeFromScheduleItems(form.scheduleItems);
                  return autoEndTime ? (
                    <>Auto: {autoEndTime} (from latest schedule item)</>
                  ) : (
                    <>Cannot calculate end time (no schedule items)</>
                  );
                })()}
              </div>
            ) : (
              <Input
                type="time"
                value={form.endTime ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value || null }))}
              />
            )}
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

        <div>
          <div className="mb-1 text-sm font-medium">Location</div>
          <Select
            value={form.locationId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__new__") {
                setNewLocationOpen("locationId");
                return;
              }
              setForm((f) => ({ ...f, locationId: v || undefined }));
            }}
          >
            <option value="">Select…</option>
            {locations.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
            <option value="__new__">+ New location…</option>
          </Select>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium">Participants</div>
          <div className="mb-2">
            <Input
              value={participantQuery}
              onChange={(e) => setParticipantQuery(e.target.value)}
              placeholder="Search participants… (type at least 3 letters)"
            />
          </div>
          {participantQuery.trim().length < 3 ? (
            <div className="text-xs text-zinc-600">Type at least 3 letters to search participants.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {participants
                .filter((p) => {
                  const q = participantQuery.trim().toLowerCase();
                  const roleMatch = Array.isArray(p.roles)
                    ? p.roles.some((r) => r.toLowerCase().includes(q))
                    : false;
                  return (
                    p.name.toLowerCase().includes(q) ||
                    roleMatch ||
                    (p.email ?? "").toLowerCase().includes(q)
                  );
                })
                .map((p) => {
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
                          ({Array.isArray(p.roles) && p.roles.length ? p.roles.join(", ") : "—"})
                        </span>
                      </span>
                    </label>
                  );
                })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setNewParticipantOpen(true)}
            className="mt-2 rounded border border-dashed border-zinc-300 p-2 text-left text-sm hover:bg-zinc-50"
          >
            + New participant…
          </button>
        </div>

        {/* Advance Participants */}
        <div>
          <div className="mb-1 text-sm font-medium">Advance (participants who will be there before)</div>
          {form.advanceParticipantIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {form.advanceParticipantIds.map((pid) => {
                const p = participants.find((p) => p.id === pid);
                if (!p) return null;
                return (
                  <span
                    key={pid}
                    className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700 border border-emerald-200"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          advanceParticipantIds: f.advanceParticipantIds.filter((id) => id !== pid),
                        }));
                      }}
                      className="text-emerald-500 hover:text-emerald-700"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="mb-2">
            <Input
              value={advanceParticipantQuery}
              onChange={(e) => setAdvanceParticipantQuery(e.target.value)}
              placeholder="Search participants… (type at least 3 letters)"
            />
          </div>
          {advanceParticipantQuery.trim().length < 3 ? (
            <div className="text-xs text-zinc-600">Type at least 3 letters to search participants.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {participants
                .filter((p) => {
                  const q = advanceParticipantQuery.trim().toLowerCase();
                  const roleMatch = Array.isArray(p.roles)
                    ? p.roles.some((r) => r.toLowerCase().includes(q))
                    : false;
                  return (
                    (p.name.toLowerCase().includes(q) ||
                      roleMatch ||
                      (p.email ?? "").toLowerCase().includes(q)) &&
                    !form.advanceParticipantIds.includes(p.id)
                  );
                })
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        advanceParticipantIds: [...f.advanceParticipantIds, p.id],
                      }));
                      setAdvanceParticipantQuery("");
                    }}
                    className="text-left rounded border border-zinc-200 p-2 text-sm hover:bg-zinc-50 cursor-pointer"
                  >
                    {p.name}{" "}
                    <span className="text-xs text-zinc-600">
                      ({Array.isArray(p.roles) && p.roles.length ? p.roles.join(", ") : "—"})
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Met By Participants */}
        <div>
          <div className="mb-1 text-sm font-medium">Met By (participants who will meet/greet)</div>
          {form.metByParticipantIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {form.metByParticipantIds.map((pid) => {
                const p = participants.find((p) => p.id === pid);
                if (!p) return null;
                return (
                  <span
                    key={pid}
                    className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-200"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          metByParticipantIds: f.metByParticipantIds.filter((id) => id !== pid),
                        }));
                      }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="mb-2">
            <Input
              value={metByParticipantQuery}
              onChange={(e) => setMetByParticipantQuery(e.target.value)}
              placeholder="Search participants… (type at least 3 letters)"
            />
          </div>
          {metByParticipantQuery.trim().length < 3 ? (
            <div className="text-xs text-zinc-600">Type at least 3 letters to search participants.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {participants
                .filter((p) => {
                  const q = metByParticipantQuery.trim().toLowerCase();
                  const roleMatch = Array.isArray(p.roles)
                    ? p.roles.some((r) => r.toLowerCase().includes(q))
                    : false;
                  return (
                    (p.name.toLowerCase().includes(q) ||
                      roleMatch ||
                      (p.email ?? "").toLowerCase().includes(q)) &&
                    !form.metByParticipantIds.includes(p.id)
                  );
                })
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        metByParticipantIds: [...f.metByParticipantIds, p.id],
                      }));
                      setMetByParticipantQuery("");
                    }}
                    className="text-left rounded border border-zinc-200 p-2 text-sm hover:bg-zinc-50 cursor-pointer"
                  >
                    {p.name}{" "}
                    <span className="text-xs text-zinc-600">
                      ({Array.isArray(p.roles) && p.roles.length ? p.roles.join(", ") : "—"})
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-sm font-medium">Attachments</div>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 p-4 text-sm hover:bg-zinc-50"
            onClick={() => {
              const inp = document.createElement("input");
              inp.type = "file";
              inp.multiple = true;
              inp.onchange = () => onFilesChosen(inp.files ? Array.from(inp.files) : []);
              inp.click();
            }}
          >
            <div>Drag & drop files here or click to upload</div>
          </div>
          {attachments.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.url} className="flex items-center gap-2 rounded border border-zinc-300 px-2 py-1 text-xs">
                  <a href={a.url} target="_blank" rel="noreferrer" className="underline">
                    {a.name}
                  </a>
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-900"
                    onClick={() => removeAttachment(a.url)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-600">No files added.</div>
          )}
          <div className="mt-3">
            <div className="mb-1 text-sm font-medium">Or paste URLs (comma separated)</div>
            <Input
              value={form.attachmentsText}
              onChange={(e) => setForm((f) => ({ ...f, attachmentsText: e.target.value }))}
              placeholder="https://example.com/file.pdf, https://…"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium">Schedule Items</div>
          <div className="space-y-3">
            {form.scheduleItems.map((item, idx) => (
              <div key={item.id} className="rounded-lg border border-zinc-200 p-3 bg-zinc-50">
                <div className="flex items-start gap-2 mb-3">
                  <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input
                      type="time"
                      value={item.time}
                      onChange={(e) => {
                        setForm((f) => {
                          const updatedItems = f.scheduleItems.map((si, i) => (i === idx ? { ...si, time: e.target.value } : si));
                          return {
                            ...f,
                            scheduleItems: updatedItems,
                            // Update endTime if auto is enabled
                            endTime: f.endTimeFixed === false ? (calculateEndTimeFromScheduleItems(updatedItems) ?? f.endTime) : f.endTime,
                          };
                        });
                      }}
                    />
                    <Input
                      className="sm:col-span-2"
                      value={item.description}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          scheduleItems: f.scheduleItems.map((si, i) => (i === idx ? { ...si, description: e.target.value } : si)),
                        }));
                      }}
                      placeholder="Description"
                    />
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setForm((f) => {
                        const updatedItems = f.scheduleItems.filter((_, i) => i !== idx);
                        return {
                          ...f,
                          scheduleItems: updatedItems,
                          // Update endTime if auto is enabled
                          endTime: f.endTimeFixed === false ? (calculateEndTimeFromScheduleItems(updatedItems) ?? f.endTime) : f.endTime,
                        };
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-700">Staff Instructions</div>
                    <textarea
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                      rows={2}
                      value={item.staffInstructions ?? ""}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          scheduleItems: f.scheduleItems.map((si, i) => (i === idx ? { ...si, staffInstructions: e.target.value || undefined } : si)),
                        }));
                      }}
                      placeholder="Instructions for staff"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-700">Guest Instructions</div>
                    <textarea
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                      rows={2}
                      value={item.guestInstructions ?? ""}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          scheduleItems: f.scheduleItems.map((si, i) => (i === idx ? { ...si, guestInstructions: e.target.value || undefined } : si)),
                        }));
                      }}
                      placeholder="Instructions for guests"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-medium text-zinc-700">Notes</div>
                  <textarea
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                    rows={2}
                    value={item.notes ?? ""}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        scheduleItems: f.scheduleItems.map((si, i) => (i === idx ? { ...si, notes: e.target.value || undefined } : si)),
                      }));
                    }}
                    placeholder="Additional notes for this schedule item"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => {
                setForm((f) => {
                  const newItem = { id: generateId(), time: "12:00", description: "", staffInstructions: undefined, guestInstructions: undefined, notes: undefined };
                  const updatedItems = [...f.scheduleItems, newItem];
                  return {
                    ...f,
                    scheduleItems: updatedItems,
                    // Update endTime if auto is enabled
                    endTime: f.endTimeFixed === false ? (calculateEndTimeFromScheduleItems(updatedItems) ?? f.endTime) : f.endTime,
                  };
                });
              }}
            >
              + Add schedule item
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium">Notes</div>
          <Input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Link href={`/admin/days/${dayId}`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button onClick={saveForm} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create Block" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* New Location modal */}
      <Modal
        open={!!newLocationOpen}
        onClose={() => setNewLocationOpen(false)}
        title="New location"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewLocationOpen(false as any)}>
              Cancel
            </Button>
            <Button onClick={createLocation}>Create</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Name</div>
            <Input
              value={newLocationForm.name}
              onChange={(e) => setNewLocationForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Type</div>
            <Select
              value={newLocationForm.type}
              onChange={(e) => setNewLocationForm((f) => ({ ...f, type: e.target.value as Location["type"] }))}
            >
              <option value="venue">venue</option>
              <option value="hotel">hotel</option>
              <option value="restaurant">restaurant</option>
              <option value="generic">generic</option>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Google Maps Link</div>
            <Input
              value={newLocationForm.googleMapsLink ?? ""}
              onChange={(e) => setNewLocationForm((f) => ({ ...f, googleMapsLink: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Address</div>
            <Input
              value={newLocationForm.address ?? ""}
              onChange={(e) => setNewLocationForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* New Participant modal */}
      <Modal
        open={newParticipantOpen}
        onClose={() => setNewParticipantOpen(false)}
        title="New participant"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewParticipantOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createParticipant}>Create</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Name</div>
            <Input
              value={newParticipantForm.name ?? ""}
              onChange={(e) => setNewParticipantForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Roles</div>
            <Select
              multiple
              value={(newParticipantForm.roles as string[]) ?? []}
              onChange={(e) => {
                const selected = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
                setNewParticipantForm((f) => ({ ...f, roles: selected }));
              }}
              size={Math.min(8, PARTICIPANT_ROLES.length)}
            >
              {PARTICIPANT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Email</div>
            <Input
              value={newParticipantForm.email ?? ""}
              onChange={(e) => setNewParticipantForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Phone</div>
            <Input
              value={newParticipantForm.phone ?? ""}
              onChange={(e) => setNewParticipantForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}


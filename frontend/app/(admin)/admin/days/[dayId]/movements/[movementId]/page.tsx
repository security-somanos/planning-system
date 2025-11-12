'use client';
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { mockApi } from "@/lib/mockApi";
import { Day, DrivingTimeUnit, Location, Movement, Participant, ToTimeType, Vehicle, VehicleAssignment } from "@/lib/types";
import { generateId } from "@/lib/id";
import { generateRouteUrl } from "@/lib/routeUtils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

type MovementFormState = {
  id?: string;
  title: string;
  description?: string;
  fromLocationId: string;
  toLocationId: string;
  fromTime: string; // HH:mm (always fixed)
  toTimeType: ToTimeType; // "fixed" or "driving"
  toTime: string; // HH:mm if fixed
  drivingTimeHours: number; // Hours if driving
  drivingTimeMinutes: number; // Minutes if driving
  vehicleAssignments: VehicleAssignment[];
  notes?: string;
};

function emptyForm(): MovementFormState {
  return {
    title: "",
    description: "",
    fromLocationId: "",
    toLocationId: "",
    fromTime: "09:00",
    toTimeType: "fixed",
    toTime: "10:00",
    drivingTimeHours: 0,
    drivingTimeMinutes: 0,
    vehicleAssignments: [],
    notes: "",
  };
}

// Sortable Participant Component
function SortableParticipant({
  participant,
  vehicleAssignmentIdx,
  participantIdx,
  onRemove,
}: {
  participant: Participant;
  vehicleAssignmentIdx: number;
  participantIdx: number;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `participant-${vehicleAssignmentIdx}-${participantIdx}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-emerald-600 hover:text-emerald-800"
        type="button"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span>{participant.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-emerald-700 hover:text-emerald-900 ml-auto"
      >
        ✕
      </button>
    </div>
  );
}

// Sortable Vehicle Assignment Component
function SortableVehicleAssignment({
  va,
  idx,
  vehicles,
  drivers,
  participants,
  participantSearchQueries,
  setParticipantSearchQueries,
  onUpdate,
  onRemove,
  activeParticipantId,
  setActiveParticipantId,
}: {
  va: VehicleAssignment;
  idx: number;
  vehicles: Vehicle[];
  drivers: Participant[];
  participants: Participant[];
  participantSearchQueries: Record<number, string>;
  setParticipantSearchQueries: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onUpdate: (idx: number, updates: Partial<VehicleAssignment>) => void;
  onRemove: (idx: number) => void;
  activeParticipantId: string | null;
  setActiveParticipantId: (id: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `va-${idx}` });

  // Check if capacity is exceeded
  const vehicle = va.vehicleId ? vehicles.find((v) => v.id === va.vehicleId) : null;
  const capacity = vehicle?.capacity;
  const currentCount = va.participantIds?.length ?? 0;
  const isCapacityExceeded = capacity !== undefined && currentCount > capacity;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
    borderTopColor: '#b34f59',
  };

  const vehicleLabel = vehicle?.label || "";
  const cardTitle = vehicleLabel ? `#${idx + 1} - ${vehicleLabel}` : `#${idx + 1}`;

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-zinc-200 border-t-[3px] p-3 bg-[#fcfcfc]">
      <div className="mb-3 text-md font-semibold text-[#b34f59]">{cardTitle}</div>
      <div className="flex items-start gap-2 mb-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600"
          type="button"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <div className="mb-1 text-xs font-medium">Vehicle</div>
            <Select
              value={va.vehicleId}
              onChange={(e) => onUpdate(idx, { vehicleId: e.target.value })}
            >
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} {v.make && v.model ? `(${v.make} ${v.model})` : ""} {v.capacity ? `- ${v.capacity} seats` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium">Driver</div>
            <Select
              value={va.driverId ?? ""}
              onChange={(e) => onUpdate(idx, { driverId: e.target.value || undefined })}
            >
              <option value="">No driver</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onRemove(idx)}
            >
              Remove
            </Button>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium">Participants</span>
          {(() => {
            const vehicle = va.vehicleId ? vehicles.find((v) => v.id === va.vehicleId) : null;
            const capacity = vehicle?.capacity;
            const currentCount = va.participantIds?.length ?? 0;
            if (capacity !== undefined) {
              return (
                <span className={`text-xs ${currentCount > capacity ? "text-[#920712] font-medium" : "text-zinc-500"}`}>
                  {currentCount} / {capacity}
                </span>
              );
            }
            return <span className="text-xs text-zinc-500">{currentCount} assigned</span>;
          })()}
        </div>
        {isCapacityExceeded && (
          <div className="mb-2 rounded-md border border-[#920712] bg-[#92071214] px-2 py-1.5 text-xs text-[#920712]">
            Vehicle capacity exceeded: {currentCount} participants assigned, but vehicle only supports {capacity}
          </div>
        )}
        <div className="mb-2">
          <Input
            value={participantSearchQueries[idx] || ""}
            onChange={(e) => {
              setParticipantSearchQueries((prev) => ({ ...prev, [idx]: e.target.value }));
            }}
            placeholder="Search participants… (type at least 3 letters)"
            className="text-sm"
          />
        </div>
        {(() => {
          const vehicle = va.vehicleId ? vehicles.find((v) => v.id === va.vehicleId) : null;
          const capacity = vehicle?.capacity;
          const query = (participantSearchQueries[idx] || "").trim().toLowerCase();
          const filteredParticipants = query.length < 3
            ? []
            : participants.filter((p) => {
                const roleMatch = Array.isArray(p.roles)
                  ? p.roles.some((r) => r.toLowerCase().includes(query))
                  : false;
                return (
                  p.name.toLowerCase().includes(query) ||
                  roleMatch ||
                  (p.email ?? "").toLowerCase().includes(query)
                );
              });
          // Maintain order from participantIds array
          const selectedParticipants = va.participantIds
            ? va.participantIds
                .map((id) => participants.find((p) => p.id === id))
                .filter((p): p is Participant => p !== undefined)
            : [];
          
          // Participant drag handlers
          const handleParticipantDragStart = (event: DragStartEvent) => {
            setActiveParticipantId(event.active.id as string);
          };

          const handleParticipantDragEnd = (event: DragEndEvent) => {
            const { active, over } = event;
            setActiveParticipantId(null);
            
            if (!over || active.id === over.id) return;

            const activeId = String(active.id);
            const overId = String(over.id);
            
            // Extract indices from IDs (format: participant-{vaIdx}-{pIdx})
            const activeMatch = activeId.match(/participant-(\d+)-(\d+)/);
            const overMatch = overId.match(/participant-(\d+)-(\d+)/);
            
            if (!activeMatch || !overMatch) return;
            if (activeMatch[1] !== overMatch[1]) return; // Must be same vehicle assignment
            
            const fromIdx = parseInt(activeMatch[2]);
            const toIdx = parseInt(overMatch[2]);
            
            if (va.participantIds) {
              const reordered = arrayMove(va.participantIds, fromIdx, toIdx);
              onUpdate(idx, { participantIds: reordered });
            }
          };

          // Participant sensors
          const participantSensors = useSensors(
            useSensor(PointerSensor),
            useSensor(KeyboardSensor, {
              coordinateGetter: sortableKeyboardCoordinates,
            })
          );
          
          return (
            <div className="space-y-2">
              {selectedParticipants.length > 0 && (
                <div>
                  <div className="mb-1 text-xs text-zinc-600 font-medium">Selected ({selectedParticipants.length})</div>
                  <DndContext
                    sensors={participantSensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleParticipantDragStart}
                    onDragEnd={handleParticipantDragEnd}
                  >
                    <SortableContext
                      items={selectedParticipants.map((_, pIdx) => `participant-${idx}-${pIdx}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-wrap gap-2">
                        {selectedParticipants.map((p, pIdx) => (
                          <SortableParticipant
                            key={p.id}
                            participant={p}
                            vehicleAssignmentIdx={idx}
                            participantIdx={pIdx}
                            onRemove={() => {
                              onUpdate(idx, { participantIds: va.participantIds?.filter((id) => id !== p.id) ?? [] });
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <DragOverlay>
                      {activeParticipantId ? (() => {
                        const match = String(activeParticipantId).match(/participant-(\d+)-(\d+)/);
                        if (!match || match[1] !== String(idx)) return null;
                        const pIdx = parseInt(match[2]);
                        const p = selectedParticipants[pIdx];
                        if (!p) return null;
                        return (
                          <div className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs opacity-90 rotate-2 shadow-lg">
                            <GripVertical className="h-3 w-3 text-emerald-600" />
                            <span>{p.name}</span>
                          </div>
                        );
                      })() : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}
              {query.length < 3 ? (
                <div className="text-xs text-zinc-500">Type at least 3 letters to search participants.</div>
              ) : filteredParticipants.length === 0 ? (
                <div className="text-xs text-zinc-500">No participants found.</div>
              ) : (
                <div>
                  <div className="mb-1 text-xs text-zinc-600 font-medium">Search Results</div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredParticipants
                      .filter((p) => !va.participantIds || !va.participantIds.includes(p.id))
                      .map((p) => {
                        const canAdd = capacity === undefined || (va.participantIds && va.participantIds.length < capacity);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={!canAdd}
                            onClick={() => {
                              if (!canAdd) return;
                              onUpdate(idx, { participantIds: [...(va.participantIds || []), p.id] });
                              setParticipantSearchQueries((prev) => ({ ...prev, [idx]: "" }));
                            }}
                            className={`w-full text-left rounded border border-zinc-200 p-2 text-xs hover:bg-zinc-50 ${
                              !canAdd ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <div className="font-medium">{p.name}</div>
                            {Array.isArray(p.roles) && p.roles.length > 0 && (
                              <div className="text-zinc-500 text-xs mt-0.5">{p.roles.join(", ")}</div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                  {capacity !== undefined && va.participantIds && va.participantIds.length >= capacity && (
                    <div className="mt-2 text-xs text-red-600 font-medium">
                      Vehicle capacity reached ({capacity} participants)
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function MovementEditorPage() {
  const params = useParams<{ dayId: string; movementId: string }>();
  const router = useRouter();
  const dayId = params.dayId;
  const movementId = params.movementId;
  const isNew = movementId === "new";

  const [day, setDay] = useState<Day | null>(null);
  const [movement, setMovement] = useState<Movement | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<MovementFormState>(emptyForm());
  const [newLocationOpen, setNewLocationOpen] = useState<false | "from" | "to">(false);
  const [newLocationForm, setNewLocationForm] = useState<{ name: string; type: Location["type"]; address?: string; googleMapsLink?: string }>({
    name: "",
    type: "generic",
    address: "",
    googleMapsLink: "",
  });
  const [participantSearchQueries, setParticipantSearchQueries] = useState<Record<number, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  
  // Get Google Maps API key from environment (client-side)
  const googleMapsApiKey = typeof window !== "undefined" 
    ? (window as any).__GOOGLE_MAPS_API_KEY__ || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 
    : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle vehicle assignment drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle vehicle assignment drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over || active.id === over.id) return;

    const activeIndex = parseInt(String(active.id).replace('va-', ''));
    const overIndex = parseInt(String(over.id).replace('va-', ''));

    setForm((f) => ({
      ...f,
      vehicleAssignments: arrayMove(f.vehicleAssignments || [], activeIndex, overIndex),
    }));
  };

  // Helper functions for vehicle assignment updates
  const updateVehicleAssignment = (idx: number, updates: Partial<VehicleAssignment>) => {
    setForm((f) => ({
      ...f,
      vehicleAssignments: (f.vehicleAssignments || []).map((v, i) =>
        i === idx ? { ...v, ...updates } : v
      ),
    }));
  };

  const removeVehicleAssignment = (idx: number) => {
    setForm((f) => ({
      ...f,
      vehicleAssignments: (f.vehicleAssignments || []).filter((_, i) => i !== idx),
    }));
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      mockApi.get<{ item: Day }>(`/days/${dayId}`),
      mockApi.get<{ items: Participant[] }>("/participants"),
      mockApi.get<{ items: Location[] }>("/locations"),
      mockApi.get<{ items: Vehicle[] }>("/vehicles"),
    ])
      .then(([d, p, l, v]) => {
        if (!mounted) return;
        setDay(d.item);
        setParticipants(p.items);
        setLocations(l.items);
        setVehicles(v.items);
        if (!isNew) {
          const foundMovement = d.item.movements?.find((m) => m.id === movementId);
          if (foundMovement) {
            setMovement(foundMovement);
            // Parse driving time if needed
            let drivingTimeHours = 0;
            let drivingTimeMinutes = 0;
            if (foundMovement.toTimeType === "driving") {
              const totalMinutes = parseInt(foundMovement.toTime) || 0;
              drivingTimeHours = Math.floor(totalMinutes / 60);
              drivingTimeMinutes = totalMinutes % 60;
            }
            setForm({
              id: foundMovement.id,
              title: foundMovement.title,
              description: foundMovement.description,
              fromLocationId: foundMovement.fromLocationId,
              toLocationId: foundMovement.toLocationId,
              fromTime: foundMovement.fromTime,
              toTimeType: foundMovement.toTimeType,
              toTime: foundMovement.toTimeType === "fixed" ? foundMovement.toTime : "",
              drivingTimeHours,
              drivingTimeMinutes,
              vehicleAssignments: foundMovement.vehicleAssignments ?? [],
              notes: foundMovement.notes,
            });
          } else {
            setError("Movement not found.");
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
  }, [dayId, movementId, isNew]);

  const createLocation = async () => {
    if (!newLocationForm.name) return;
    const res = await mockApi.post<{ item: Location }>("/locations", newLocationForm);
    setLocations((prev) => [...prev, res.item]);
    if (newLocationOpen === "from") {
      setForm((f) => ({ ...f, fromLocationId: res.item.id }));
    } else if (newLocationOpen === "to") {
      setForm((f) => ({ ...f, toLocationId: res.item.id }));
    }
    setNewLocationOpen(false);
    setNewLocationForm({ name: "", type: "generic", address: "", googleMapsLink: "" });
  };

  const saveForm = async () => {
    // Validate capacity
    for (const va of form.vehicleAssignments || []) {
      if (va.vehicleId) {
        const vehicle = vehicles.find((v) => v.id === va.vehicleId);
        if (vehicle?.capacity !== undefined && va.participantIds && va.participantIds.length > vehicle.capacity) {
          setError(`Vehicle "${vehicle.label}" exceeds capacity: ${va.participantIds.length} > ${vehicle.capacity}`);
          return;
        }
      }
    }
    
    setSaving(true);
    setError("");
    try {
      // Convert driving time to total minutes
      const toTime = form.toTimeType === "fixed" 
        ? form.toTime 
        : String(form.drivingTimeHours * 60 + form.drivingTimeMinutes);
      const payload = {
        title: form.title,
        description: form.description,
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        fromTime: form.fromTime,
        toTimeType: form.toTimeType,
        toTime,
        drivingTimeHours: form.toTimeType === "driving" ? form.drivingTimeHours : undefined,
        drivingTimeMinutes: form.toTimeType === "driving" ? form.drivingTimeMinutes : undefined,
        vehicleAssignments: form.vehicleAssignments || null,
        notes: form.notes,
      };
      if (isNew) {
        await mockApi.post(`/days/${dayId}/movements`, payload);
      } else {
        await mockApi.put(`/days/${dayId}/movements/${movementId}`, payload);
      }
      router.push(`/admin/days/${dayId}`);
    } catch (err) {
      setError("Failed to save movement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title={isNew ? "New Movement" : "Edit Movement"}>
        <div className="text-sm text-zinc-600">Loading…</div>
      </AdminLayout>
    );
  }

  if (error && !isNew && !movement) {
    return (
      <AdminLayout title="Error">
        <div className="text-sm text-red-600">{error}</div>
        <Link href={`/admin/days/${dayId}`}>
          <Button variant="secondary" className="mt-4">Back to Day</Button>
        </Link>
      </AdminLayout>
    );
  }

  const drivers = participants.filter((p) => p.roles?.includes("Drivers"));

  return (
    <AdminLayout title={isNew ? "New Movement" : `Edit Movement: ${movement?.title ?? ""}`}>
      <div className="mb-4">
        <Link href={`/admin/days/${dayId}`}>
          <Button variant="secondary">← Back to Day</Button>
        </Link>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Trip Information Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="space-y-6">
            <div>
              <div className="mb-1 text-sm font-medium">Title</div>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium">Description</div>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-medium">From Location</div>
                <Select
                  value={form.fromLocationId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__new__") {
                      setNewLocationOpen("from");
                      return;
                    }
                    setForm((f) => ({ ...f, fromLocationId: v }));
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
                <div className="mb-1 text-sm font-medium">To Location</div>
                <Select
                  value={form.toLocationId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__new__") {
                      setNewLocationOpen("to");
                      return;
                    }
                    setForm((f) => ({ ...f, toLocationId: v }));
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
            </div>

            {(() => {
              const fromLoc = form.fromLocationId ? locations.find((l) => l.id === form.fromLocationId) : null;
              const toLoc = form.toLocationId ? locations.find((l) => l.id === form.toLocationId) : null;
              const routeUrl = fromLoc && toLoc ? generateRouteUrl(fromLoc, toLoc) : null;
              
              if (routeUrl && fromLoc && toLoc) {
                return (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-medium">Route</div>
                      <a
                        href={routeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Open in Google Maps →
                      </a>
                    </div>
                    {googleMapsApiKey ? (
                      <div className="h-64 w-full overflow-hidden rounded border border-zinc-300 bg-white">
                        <iframe
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps/embed/v1/directions?key=${googleMapsApiKey}&origin=${encodeURIComponent(fromLoc.address || fromLoc.name)}&destination=${encodeURIComponent(toLoc.address || toLoc.name)}&mode=driving&zoom=10`}
                        />
                      </div>
                    ) : (
                      <div className="h-64 w-full flex items-center justify-center rounded border border-zinc-300 bg-zinc-100">
                        <div className="text-center text-xs text-zinc-600 p-4">
                          <div className="mb-2">Route preview requires Google Maps API key</div>
                          <div>Click "Open in Google Maps" to view the route</div>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-zinc-500">
                      Route from {fromLoc.name} to {toLoc.name}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-sm font-medium">Departure Time</div>
                <Input
                  type="time"
                  value={form.fromTime}
                  onChange={(e) => setForm((f) => ({ ...f, fromTime: e.target.value }))}
                />
                <div className="mt-1 text-xs text-zinc-500">Always fixed</div>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">Arrival</div>
                <Select
                  value={form.toTimeType}
                  onChange={(e) => setForm((f) => ({ ...f, toTimeType: e.target.value as ToTimeType }))}
                  className="mb-2"
                >
                  <option value="fixed">Fixed arrival time</option>
                  <option value="driving">Driving time</option>
                </Select>
                {form.toTimeType === "fixed" ? (
                  <Input
                    type="time"
                    value={form.toTime}
                    onChange={(e) => setForm((f) => ({ ...f, toTime: e.target.value }))}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-1 text-xs text-zinc-600">Hours</div>
                      <Input
                        type="number"
                        min="0"
                        value={form.drivingTimeHours}
                        onChange={(e) => setForm((f) => ({ ...f, drivingTimeHours: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-zinc-600">Minutes</div>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={form.drivingTimeMinutes}
                        onChange={(e) => setForm((f) => ({ ...f, drivingTimeMinutes: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                )}
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
          </div>
        </div>

        {/* Vehicle Assignments Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="space-y-6">
            <div>
              <div className="mb-4 text-sm font-medium">Vehicle Assignments</div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={(form.vehicleAssignments || []).map((_, idx) => `va-${idx}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-8">
                    {(form.vehicleAssignments || []).map((va, idx) => (
                      <SortableVehicleAssignment
                        key={`va-${idx}`}
                        va={va}
                        idx={idx}
                        vehicles={vehicles}
                        drivers={drivers}
                        participants={participants}
                        participantSearchQueries={participantSearchQueries}
                        setParticipantSearchQueries={setParticipantSearchQueries}
                        onUpdate={updateVehicleAssignment}
                        onRemove={removeVehicleAssignment}
                        activeParticipantId={activeParticipantId}
                        setActiveParticipantId={setActiveParticipantId}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeId ? (() => {
                    const idx = parseInt(activeId.replace('va-', ''));
                    const va = form.vehicleAssignments?.[idx];
                    if (!va) return null;
                    return (
                      <div className="rounded-lg border border-zinc-200 border-t-[3px] p-3 bg-white rotate-2 shadow-lg w-full max-w-md" style={{ borderTopColor: '#b34f59' }}>
                        <div className="flex items-start gap-2 mb-3">
                          <div className="mt-1 text-zinc-400">
                            <GripVertical className="h-5 w-5" />
                          </div>
                          <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <div className="mb-1 text-xs font-medium">Vehicle</div>
                              <div className="text-xs text-zinc-600">
                                {va.vehicleId ? vehicles.find((v) => v.id === va.vehicleId)?.label ?? "-" : "Select vehicle…"}
                              </div>
                            </div>
                            <div>
                              <div className="mb-1 text-xs font-medium">Driver</div>
                              <div className="text-xs text-zinc-600">
                                {va.driverId ? drivers.find((d) => d.id === va.driverId)?.name ?? "-" : "No driver"}
                              </div>
                            </div>
                            <div className="flex items-end">
                              <div className="text-xs text-zinc-500">{(va.participantIds?.length ?? 0)} participants</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}
                </DragOverlay>
              </DndContext>
              <div className="mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      vehicleAssignments: [...(f.vehicleAssignments || []), { vehicleId: "", driverId: undefined, participantIds: [] }],
                    }));
                  }}
                >
                  + Add vehicle assignment
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2">
          <Link href={`/admin/days/${dayId}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button variant="secondary" onClick={saveForm} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create Movement" : "Save Changes"}
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
    </AdminLayout>
  );
}


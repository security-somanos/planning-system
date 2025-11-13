'use client';
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Edit, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { mockApi } from "@/lib/mockApi";
import { Block, BlockType, Day, Location, Movement, Participant, Vehicle } from "@/lib/types";
import { calculateEndTime } from "@/lib/blockUtils";
import { calculateArrivalTime, getMovementStartTime } from "@/lib/movementUtils";
import { generateRouteUrl } from "@/lib/routeUtils";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";

function BlockBadge({ type }: { type: BlockType }) {
  const cls =
    type === "activity"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs ${cls}`}>{type}</span>;
}

function MovementBadge() {
  return (
    <span 
      className="inline-block rounded border px-2 py-0.5 text-xs"
      style={{ backgroundColor: '#bba26a14', color: '#bba26a', borderColor: '#bba26a' }}
    >
      movement
    </span>
  );
}

export default function DayEditorPage() {
  const params = useParams<{ dayId: string }>();
  const dayId = params.dayId;

  const [day, setDay] = useState<Day | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Get Google Maps API key from environment (client-side)
  const googleMapsApiKey = typeof window !== "undefined" 
    ? (window as any).__GOOGLE_MAPS_API_KEY__ || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 
    : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
      })
      .catch(() => {
        if (!mounted) return;
        setError("Failed to load day.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [dayId]);

  // Refresh when returning from block editor
  useEffect(() => {
    const handleFocus = () => {
      mockApi.get<{ item: Day }>(`/days/${dayId}`).then((res) => setDay(res.item));
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [dayId]);

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

  const vehicleById = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehicles) map.set(v.id, v);
    return map;
  }, [vehicles]);

  const deleteBlock = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await mockApi.delete(`/days/${dayId}/blocks/${id}`);
    const updated = await mockApi.get<{ item: Day }>(`/days/${dayId}`);
    setDay(updated.item);
  };

  const moveBlock = async (index: number, dir: -1 | 1) => {
    if (!day || !day.blocks) return;
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= day.blocks.length) return;
    const order = [...day.blocks.map((b) => b.id)];
    const [moved] = order.splice(index, 1);
    order.splice(nextIdx, 0, moved);
    await mockApi.post(`/days/${dayId}/blocks/reorder`, { order });
    const updated = await mockApi.get<{ item: Day }>(`/days/${dayId}`);
    setDay(updated.item);
  };

  // Merge blocks and movements into a single timeline, sorted by start time
  const timelineItems = useMemo(() => {
    if (!day) return [];
    const items: Array<{ type: "block" | "movement"; item: Block | Movement; startTime: string }> = [];
    
    // Add blocks
    if (day.blocks) {
      for (const block of day.blocks) {
        items.push({ type: "block", item: block, startTime: block.startTime });
      }
    }
    
    // Add movements
    if (day.movements) {
      for (const movement of day.movements) {
        items.push({ type: "movement", item: movement, startTime: getMovementStartTime(movement) });
      }
    }
    
    // Sort by start time
    items.sort((a, b) => {
      const timeA = a.startTime.split(":").map(Number);
      const timeB = b.startTime.split(":").map(Number);
      const minutesA = timeA[0] * 60 + timeA[1];
      const minutesB = timeB[0] * 60 + timeB[1];
      return minutesA - minutesB;
    });
    
    return items;
  }, [day]);

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
            <div className="flex gap-2">
              <Link href={`/admin/days/${dayId}/movements/new`}>
                <Button variant="secondary">Add movement</Button>
              </Link>
              <Link href={`/admin/days/${dayId}/blocks/new`}>
                <Button>Add event</Button>
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {timelineItems.length === 0 ? (
              <div className="text-sm text-zinc-600">No activities or movements yet.</div>
            ) : (
              timelineItems.map((timelineItem) => {
                if (timelineItem.type === "block") {
                  const b = timelineItem.item as Block;
                  const blockIdx = day.blocks?.findIndex((blk) => blk.id === b.id) ?? -1;
                  const endTime = calculateEndTime(b);
                  const locationName = b.locationId ? locationById.get(b.locationId)?.name : null;
                  const scheduleItems = b.scheduleItems?.sort((a, b) => a.time.localeCompare(b.time)) || [];
                  
                  return (
                    <div key={`block-${b.id}`}>
                      {/* Desktop: 2 columns, Mobile: Single column */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Event Card */}
                        <div>
                          <Accordion
                            title={
                              <div className="flex items-center gap-2">
                                <div className="font-medium truncate">{b.title}</div>
                                <BlockBadge type={b.type} />
                              </div>
                            }
                            summary={
                              <div className="flex items-center gap-4 text-xs text-zinc-600">
                                <span>
                                  {endTime ? `${b.startTime}–${endTime}` : b.startTime}
                                  {b.endTimeFixed === false && (
                                    <span className="ml-1 text-zinc-400" title="Auto-calculated from schedule items">
                                      (auto)
                                    </span>
                                  )}
                                </span>
                                {locationName && <span>📍 {locationName}</span>}
                              </div>
                            }
                            className="bg-[#92071214] shadow-sm"
                            style={{ borderLeft: '4px solid #920712' }}
                            actions={
                              <>
                                {blockIdx > 0 && (
                                  <Button variant="secondary" size="sm" onClick={() => moveBlock(blockIdx, -1)}>
                                    ↑
                                  </Button>
                                )}
                                {day.blocks && blockIdx >= 0 && blockIdx < day.blocks.length - 1 && (
                                  <Button variant="secondary" size="sm" onClick={() => moveBlock(blockIdx, 1)}>
                                    ↓
                                  </Button>
                                )}
                                <Link href={`/admin/days/${dayId}/blocks/${b.id}`}>
                                  <button className="p-1.5 hover:bg-zinc-100 rounded transition-colors" title="Edit">
                                    <Edit className="h-4 w-4 text-zinc-600" />
                                  </button>
                                </Link>
                                <button 
                                  className="p-1.5 hover:bg-red-50 rounded transition-colors" 
                                  onClick={() => deleteBlock(b.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-[#920712]" />
                                </button>
                              </>
                            }
                          >
                            <div className="pt-4 space-y-4">
                              {b.description && <div className="text-sm text-zinc-700">{b.description}</div>}
                              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                  <div className="text-xs text-zinc-500">Location</div>
                                  <div>{locationName || "-"}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-500">Participants</div>
                                  <div className="truncate">
                                    {b.participantsIds?.map((pid: string) => participantById.get(pid)?.name).filter(Boolean).join(", ") ||
                                      "-"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Accordion>
                        </div>
                        
                        {/* Right: Schedule Items (Desktop only) */}
                        <div className="hidden md:block space-y-2">
                          {scheduleItems.length === 0 ? (
                            <div className="h-1"></div>
                          ) : (
                            scheduleItems.map((item) => (
                              <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                                <div className="text-xs text-zinc-700 mb-1">
                                  <span className="font-semibold text-zinc-900">{item.time}</span> {item.description}
                                </div>
                                {(item.staffInstructions || item.guestInstructions) && (
                                  <div className="mt-2 space-y-1 pl-2 border-l-2 border-zinc-300">
                                    {item.staffInstructions && (
                                      <div className="text-xs">
                                        <span className="font-medium text-zinc-700">Staff:</span>{" "}
                                        <span className="text-zinc-600">{item.staffInstructions}</span>
                                      </div>
                                    )}
                                    {item.guestInstructions && (
                                      <div className="text-xs">
                                        <span className="font-medium text-zinc-700">Guest:</span>{" "}
                                        <span className="text-zinc-600">{item.guestInstructions}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      
                      {/* Mobile: Schedule Items below */}
                      {scheduleItems.length > 0 && (
                        <div className="md:hidden mt-3 space-y-2">
                          {scheduleItems.map((item) => (
                            <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                              <div className="text-xs text-zinc-700 mb-1">
                                <span className="font-semibold text-zinc-900">{item.time}</span> {item.description}
                              </div>
                              {(item.staffInstructions || item.guestInstructions) && (
                                <div className="mt-2 space-y-1 pl-2 border-l-2 border-zinc-300">
                                  {item.staffInstructions && (
                                    <div className="text-xs">
                                      <span className="font-medium text-zinc-700">Staff:</span>{" "}
                                      <span className="text-zinc-600">{item.staffInstructions}</span>
                                    </div>
                                  )}
                                  {item.guestInstructions && (
                                    <div className="text-xs">
                                      <span className="font-medium text-zinc-700">Guest:</span>{" "}
                                      <span className="text-zinc-600">{item.guestInstructions}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  const m = timelineItem.item as Movement;
                  const arrivalTime = calculateArrivalTime(m);
                  const fromLoc = locationById.get(m.fromLocationId);
                  const toLoc = locationById.get(m.toLocationId);
                  const fromLocName = fromLoc?.name ?? "-";
                  const toLocName = toLoc?.name ?? "-";
                  
                  return (
                    <div key={`movement-${m.id}`}>
                      {/* Desktop: 2 columns, Mobile: Single column */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Movement Card */}
                        <div>
                          <Accordion
                            title={
                              <div className="flex items-center gap-2">
                                <div className="font-medium truncate">{m.title}</div>
                                <MovementBadge />
                              </div>
                            }
                            summary={
                              <div className="flex items-center gap-4 text-xs text-zinc-600">
                                <span>
                                  {m.fromTime} → {arrivalTime}
                                  {m.toTimeType === "driving" && (
                                    <span className="ml-1 text-zinc-400" title="Calculated from driving time">
                                      ({m.drivingTimeHours || 0}h {m.drivingTimeMinutes || 0}m)
                                    </span>
                                  )}
                                </span>
                                <span>📍 {fromLocName} → {toLocName}</span>
                              </div>
                            }
                            className="bg-[#bba26a14] shadow-sm"
                            style={{ borderLeft: '4px solid #bba26a' }}
                            actions={
                              <>
                                <Link href={`/admin/days/${dayId}/movements/${m.id}`}>
                                  <button className="p-1.5 hover:bg-zinc-100 rounded transition-colors" title="Edit">
                                    <Edit className="h-4 w-4 text-zinc-600" />
                                  </button>
                                </Link>
                                <button 
                                  className="p-1.5 hover:bg-red-50 rounded transition-colors" 
                                  onClick={async () => {
                                    if (!confirm("Delete this movement?")) return;
                                    await mockApi.delete(`/days/${dayId}/movements/${m.id}`);
                                    const updated = await mockApi.get<{ item: Day }>(`/days/${dayId}`);
                                    setDay(updated.item);
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-[#920712]" />
                                </button>
                              </>
                            }
                          >
                            <div className="pt-4 space-y-4">
                              {m.description && <div className="text-sm text-zinc-700">{m.description}</div>}
                              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                  <div className="text-xs text-zinc-500">From</div>
                                  <div>{fromLocName}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-500">To</div>
                                  <div>{toLocName}</div>
                                </div>
                              </div>
                              {(() => {
                                const routeUrl = fromLoc && toLoc ? generateRouteUrl(fromLoc, toLoc) : null;
                                
                                if (routeUrl) {
                                  return (
                                    <div className="border-t pt-3" style={{ borderTopColor: '#b34f5980' }}>
                                      <div className="mb-2 flex items-center justify-between">
                                        <div className="text-xs font-medium text-zinc-700">Route</div>
                                        <a
                                          href={routeUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                                        >
                                          Open in Google Maps →
                                        </a>
                                      </div>
                                      {googleMapsApiKey && fromLoc && toLoc && (fromLoc.address || fromLoc.name) && (toLoc.address || toLoc.name) ? (
                                        <div className="h-64 w-full overflow-hidden rounded border bg-white" style={{ borderColor: '#b34f5980' }}>
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
                                        <div className="h-64 w-full flex items-center justify-center rounded border bg-sky-100" style={{ borderColor: '#b34f5980' }}>
                                          <div className="text-center text-xs text-zinc-600 p-4">
                                            <div className="mb-2">Route preview requires Google Maps API key</div>
                                            <div>Click "Open in Google Maps" to view the route</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {(m.vehicleAssignments?.length ?? 0) > 0 && (
                                <div className="border-t pt-3" style={{ borderTopColor: '#b34f5980' }}>
                                  <div className="text-xs font-medium text-zinc-700 mb-2">Vehicles:</div>
                                  <div className="space-y-2">
                                    {m.vehicleAssignments!.map((va, idx) => (
                                      <div key={idx} className="rounded border bg-white p-2 text-xs" style={{ borderColor: '#b34f5980' }}>
                                        <div>
                                          <span className="font-medium">Vehicle:</span>{" "}
                                          {va.vehicleId ? vehicleById.get(va.vehicleId)?.label ?? "-" : "-"}
                                        </div>
                                        {va.driverId && (
                                          <div>
                                            <span className="font-medium">Driver:</span> {participantById.get(va.driverId)?.name ?? "-"}
                                          </div>
                                        )}
                                        {va.participantIds && va.participantIds.length > 0 && (
                                          <div>
                                            <span className="font-medium">Passengers:</span>{" "}
                                            {va.participantIds?.map((pid) => participantById.get(pid)?.name).filter(Boolean).join(", ") || "-"}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </Accordion>
                        </div>
                        
                        {/* Right: Time Information (Desktop only) */}
                        <div className="hidden md:block space-y-2">
                          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                            <div className="text-xs text-zinc-700 mb-1">
                              <span className="font-semibold text-zinc-900">{m.fromTime}</span> → <span className="font-semibold text-zinc-900">{arrivalTime}</span>
                            </div>
                            <div className="text-xs text-zinc-600 mb-1">
                              {fromLocName} → {toLocName}
                            </div>
                            {m.toTimeType === "driving" && m.drivingTimeHours !== undefined && m.drivingTimeMinutes !== undefined && (
                              <div className="text-xs text-zinc-600">
                                <span className="font-medium text-zinc-700">Driving Time:</span> {m.drivingTimeHours}h {m.drivingTimeMinutes}m
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Mobile: Time Information below */}
                      <div className="md:hidden mt-3">
                        <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                          <div className="text-xs text-zinc-700 mb-1">
                            <span className="font-semibold text-zinc-900">{m.fromTime}</span> → <span className="font-semibold text-zinc-900">{arrivalTime}</span>
                          </div>
                          <div className="text-xs text-zinc-600 mb-1">
                            {fromLocName} → {toLocName}
                          </div>
                          {m.toTimeType === "driving" && m.drivingTimeHours !== undefined && m.drivingTimeMinutes !== undefined && (
                            <div className="text-xs text-zinc-600">
                              <span className="font-medium text-zinc-700">Driving Time:</span> {m.drivingTimeHours}h {m.drivingTimeMinutes}m
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

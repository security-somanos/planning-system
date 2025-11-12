'use client';
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ParticipantLayout } from "@/components/layout/ParticipantLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Block, BlockType, Day, Location, Movement, Vehicle } from "@/lib/types";
import { calculateEndTime } from "@/lib/blockUtils";
import { calculateArrivalTime, getMovementStartTime } from "@/lib/movementUtils";
import { generateRouteUrl } from "@/lib/routeUtils";

function BlockBadge({ type }: { type: BlockType }) {
  const cls =
    type === "activity"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs ${cls}`}>{type}</span>;
}

export default function DayViewPage() {
  const params = useParams<{ dayId: string }>();
  const dayId = params.dayId;
  const { user } = useAuth();

  const [day, setDay] = useState<Day | null>(null);
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
      api.get<{ item: Day }>(`/days/${dayId}`),
      api.get<{ items: Location[] }>("/locations"),
      api.get<{ items: Vehicle[] }>("/vehicles"),
    ])
      .then(([d, l, v]) => {
        if (!mounted) return;
        setDay(d.item);
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
    <ParticipantLayout title={`Day ${day?.date ?? ""}`}>
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
            <Link href="/portal">
              <button className="text-sm text-zinc-600 hover:text-zinc-900">← Back to agenda</button>
            </Link>
          </div>

          <div className="space-y-3">
            {timelineItems.length === 0 ? (
              <div className="text-sm text-zinc-600">No activities or movements yet.</div>
            ) : (
              timelineItems.map((timelineItem) => {
                if (timelineItem.type === "block") {
                  const b = timelineItem.item as Block;
                  return (
                    <div key={`block-${b.id}`} className="rounded-lg border border-zinc-200 bg-white p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{b.title}</div>
                          <BlockBadge type={b.type} />
                        </div>
                        <div className="text-xs text-zinc-600">
                          {(() => {
                            const endTime = calculateEndTime(b);
                            if (endTime) {
                              return (
                                <>
                                  {b.startTime}–{endTime}
                                  {b.endTimeFixed === false && (
                                    <span className="ml-1 text-zinc-400" title="Auto-calculated from schedule items">
                                      (auto)
                                    </span>
                                  )}
                                </>
                              );
                            }
                            return b.startTime;
                          })()}
                        </div>
                      </div>
                      {b.description && <div className="mt-2 text-sm text-zinc-700">{b.description}</div>}
                      <div className="mt-2 grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-zinc-500">Location</div>
                          <div>{b.locationId ? locationById.get(b.locationId)?.name : "-"}</div>
                        </div>
                      </div>
                      {/* Show advance participants section only if user is in the list (backend filters this) */}
                      {b.advanceParticipantIds && b.advanceParticipantIds.length > 0 && (
                        <div className="mt-3 border-t border-zinc-200 pt-3">
                          <div className="text-xs font-medium text-zinc-700 mb-1">Advance Participants:</div>
                          <div className="text-sm text-zinc-600">You are listed as an advance participant</div>
                        </div>
                      )}
                      {/* Show met by participants section only if user is in the list (backend filters this) */}
                      {b.metByParticipantIds && b.metByParticipantIds.length > 0 && (
                        <div className="mt-3 border-t border-zinc-200 pt-3">
                          <div className="text-xs font-medium text-zinc-700 mb-1">Met By Participants:</div>
                          <div className="text-sm text-zinc-600">You are listed as meeting others</div>
                        </div>
                      )}
                      {b.scheduleItems && b.scheduleItems.length > 0 && (
                        <div className="mt-3 border-t border-zinc-200 pt-3">
                          <div className="text-xs font-medium text-zinc-700 mb-2">Schedule:</div>
                          <div className="space-y-2">
                            {b.scheduleItems
                              .sort((a, b) => a.time.localeCompare(b.time))
                              .map((item) => (
                                <div key={item.id} className="rounded border border-zinc-200 bg-zinc-50 p-2">
                                  <div className="text-xs text-zinc-600 mb-1">
                                    <span className="font-medium text-zinc-900">{item.time}</span> {item.description}
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
                        </div>
                      )}
                      {b.notes && (
                        <div className="mt-3 border-t border-zinc-200 pt-3">
                          <div className="text-xs font-medium text-zinc-700 mb-1">Notes:</div>
                          <div className="text-sm text-zinc-600">{b.notes}</div>
                        </div>
                      )}
                      {b.attachments && b.attachments.length > 0 && (
                        <div className="mt-3 border-t border-zinc-200 pt-3">
                          <div className="text-xs font-medium text-zinc-700 mb-2">Attachments:</div>
                          <div className="flex flex-wrap gap-2">
                            {b.attachments.map((attachment, idx) => (
                              <a
                                key={idx}
                                href={attachment}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                {attachment}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  const m = timelineItem.item as Movement;
                  const arrivalTime = calculateArrivalTime(m);
                  return (
                    <div key={`movement-${m.id}`} className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{m.title}</div>
                        <div className="text-xs text-zinc-600">
                          {m.fromTime} → {arrivalTime}
                          {m.toTimeType === "driving" && (
                            <span className="ml-1 text-zinc-400" title="Calculated from driving time">
                              ({m.drivingTimeHours || 0}h {m.drivingTimeMinutes || 0}m)
                            </span>
                          )}
                        </div>
                      </div>
                      {m.description && <div className="mt-2 text-sm text-zinc-700">{m.description}</div>}
                      <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-zinc-500">From</div>
                          <div>{locationById.get(m.fromLocationId)?.name ?? "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">To</div>
                          <div>{locationById.get(m.toLocationId)?.name ?? "-"}</div>
                        </div>
                      </div>
                      {(() => {
                        const fromLoc = locationById.get(m.fromLocationId);
                        const toLoc = locationById.get(m.toLocationId);
                        const routeUrl = fromLoc && toLoc ? generateRouteUrl(fromLoc, toLoc) : null;
                        
                        if (routeUrl) {
                          return (
                            <div className="mt-3 border-t border-sky-200 pt-3">
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
                                <div className="h-64 w-full overflow-hidden rounded border border-sky-300 bg-white">
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
                                <div className="h-64 w-full flex items-center justify-center rounded border border-sky-300 bg-sky-100">
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
                      {/* Vehicle assignments - backend MUST filter to only show vehicles where user is involved */}
                      {/* The backend should filter vehicleAssignments to only include:
                          1. Vehicles where user's participant ID matches driverId, OR
                          2. Vehicles where user's participant ID is in participantIds array
                      */}
                      {m.vehicleAssignments && m.vehicleAssignments.length > 0 && (
                        <div className="mt-3 border-t border-sky-200 pt-3">
                          <div className="text-xs font-medium text-zinc-700 mb-2">Vehicles:</div>
                          <div className="space-y-2">
                            {m.vehicleAssignments.map((va, idx) => {
                              // Backend should only return vehicleAssignments where user is involved
                              // If driverId exists in the response, it means user is the driver
                              // If participantIds exists and has items, it means user is in that array
                              // Since we can't query participants, we trust the backend filtered correctly
                              
                              // Show role based on what's present:
                              // - If driverId exists, user is the driver
                              // - If only participantIds exists (no driverId), user is a passenger
                              const isDriver = !!va.driverId;
                              const isPassenger = !!(va.participantIds && va.participantIds.length > 0 && !va.driverId);
                              
                              return (
                                <div key={idx} className="rounded border border-sky-200 bg-white p-2 text-xs">
                                  <div>
                                    <span className="font-medium">Vehicle:</span>{" "}
                                    {va.vehicleId ? vehicleById.get(va.vehicleId)?.label ?? "-" : "-"}
                                  </div>
                                  {isDriver && (
                                    <div>
                                      <span className="font-medium">You are the driver</span>
                                    </div>
                                  )}
                                  {isPassenger && (
                                    <div>
                                      <span className="font-medium">You are a passenger</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {m.notes && (
                        <div className="mt-3 border-t border-sky-200 pt-3">
                          <div className="text-xs font-medium text-zinc-700 mb-1">Notes:</div>
                          <div className="text-sm text-zinc-600">{m.notes}</div>
                        </div>
                      )}
                    </div>
                  );
                }
              })
            )}
          </div>
        </div>
      )}
    </ParticipantLayout>
  );
}


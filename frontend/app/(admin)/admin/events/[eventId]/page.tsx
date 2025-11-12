'use client';
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AdminLayout } from "../../../../../components/layout/AdminLayout";
import { mockApi } from "../../../../../lib/mockApi";
import { Button } from "../../../../../components/ui/Button";
import Link from "next/link";
import { Day, Event, Location, Participant } from "../../../../../lib/types";

type TabKey = "days" | "participants" | "locations" | "docs" | "timeline";

function Tabs({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (next: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "days", label: "Days" },
    { key: "participants", label: "Participants" },
    { key: "locations", label: "Locations" },
    { key: "docs", label: "Documents" },
    { key: "timeline", label: "Global Timeline" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-md border bg-white p-1">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <Button
            key={t.key}
            size="sm"
            variant={active ? "primary" : "ghost"}
            onClick={() => onChange(t.key)}
            className={active ? "" : "hover:bg-zinc-100"}
          >
            {t.label}
          </Button>
        );
      })}
    </div>
  );
}

export default function EventViewPage() {
  const params = useParams<{ eventId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>((searchParams.get("tab") as TabKey) || "days");

  const eventId = params.eventId;

  useEffect(() => {
    const t = (searchParams.get("tab") as TabKey) || "days";
    setTab(t);
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      mockApi.get<{ item: Event }>(`/events/${eventId}`),
      mockApi.get<{ items: Day[] }>(`/events/${eventId}/days`),
      mockApi.get<{ items: Participant[] }>("/participants"),
      mockApi.get<{ items: Location[] }>("/locations"),
    ])
      .then(([e, d, p, l]) => {
        if (!mounted) return;
        setEvent(e.item);
        setDays(d.items);
        setParticipants(p.items);
        setLocations(l.items);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [eventId]);

  const setUrlTab = (next: TabKey) => {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    sp.set("tab", next);
    router.replace(`/admin/events/${eventId}?${sp.toString()}`);
  };

  const participantsInEvent = useMemo(() => {
    const blockIds = new Set<string>();
    for (const d of days) {
      if (d.blocks) {
        for (const b of d.blocks) blockIds.add(b.id);
      }
    }
    return participants
      .map((p) => {
        const count = (p.assignedBlockIds?.filter((id) => blockIds.has(id)) ?? []).length;
        return { ...p, count };
      })
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [days, participants]);

  const locationsUsed = useMemo(() => {
    const ids = new Set<string>();
    for (const d of days) {
      if (d.blocks) {
        for (const b of d.blocks) {
          if (b.locationId) ids.add(b.locationId);
        }
      }
      if (d.movements) {
        for (const m of d.movements) {
          if (m.fromLocationId) ids.add(m.fromLocationId);
          if (m.toLocationId) ids.add(m.toLocationId);
        }
      }
    }
    return locations.filter((l) => ids.has(l.id));
  }, [days, locations]);

  const addDay = async () => {
    const date = prompt("Day date (YYYY-MM-DD)");
    if (!date) return;
    const res = await mockApi.post<{ item: Day }>(`/events/${eventId}/days`, { date });
    setDays((prev) => [...prev, res.item].sort((a, b) => a.date.localeCompare(b.date)));
  };

  return (
    <AdminLayout title={event ? event.name : "Event"}>
      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : !event ? (
        <div className="text-sm text-red-600">Event not found.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-600">
              {event.startDate} → {event.endDate}
            </div>
            <Tabs
              value={tab}
              onChange={(t) => {
                setTab(t);
                setUrlTab(t);
              }}
            />
          </div>

          {tab === "days" ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold">Days</div>
                <Button onClick={addDay}>Add day</Button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {days.map((d) => (
                  <Link
                    key={d.id}
                    href={`/admin/days/${d.id}`}
                    className="rounded-lg border border-zinc-200 bg-white p-4 hover:shadow-sm"
                  >
                    <div className="font-medium">{d.date}</div>
                    <div className="text-xs text-zinc-600">{d.blocks?.length ?? 0} events</div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "participants" ? (
            <div>
              <div className="mb-3 font-semibold">Participants in this event</div>
              {participantsInEvent.length === 0 ? (
                <div className="text-sm text-zinc-600">No participants assigned yet.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {participantsInEvent.map((p) => (
                    <div key={p.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-zinc-600">
                        {(Array.isArray((p as any).roles) && (p as any).roles.length ? (p as any).roles.join(", ") : "—")} • {p.count} events
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Link href="/admin/participants" className="text-sm underline">
                  Open Participant Manager →
                </Link>
              </div>
            </div>
          ) : null}

          {tab === "locations" ? (
            <div>
              <div className="mb-3 font-semibold">Locations used in this event</div>
              {locationsUsed.length === 0 ? (
                <div className="text-sm text-zinc-600">No locations used yet.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {locationsUsed.map((l) => (
                    <div key={l.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-zinc-600">{l.type}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Link href="/admin/locations" className="text-sm underline">
                  Open Location Manager →
                </Link>
              </div>
            </div>
          ) : null}

          {tab === "docs" ? (
            <div>
              <div className="mb-3 font-semibold">Documents</div>
              <div className="text-sm text-zinc-600">No documents uploaded (mock).</div>
            </div>
          ) : null}

          {tab === "timeline" ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold">Global Timeline</div>
                <Link href={`/admin/events/${eventId}/itinerary`} className="text-sm underline">
                  Open Itinerary View →
                </Link>
              </div>
              <div className="space-y-4">
                {days.map((d) => (
                  <div key={d.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="mb-2 font-medium">{d.date}</div>
                    <div className="space-y-2">
                      {d.blocks?.map((b) => (
                        <div key={b.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
                          <div className="min-w-0 truncate">{b.title}</div>
                          <div className="text-xs text-zinc-600">
                            {b.startTime}–{b.endTime}
                          </div>
                        </div>
                      )) ?? <div className="text-sm text-zinc-500">No events</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </AdminLayout>
  );
}



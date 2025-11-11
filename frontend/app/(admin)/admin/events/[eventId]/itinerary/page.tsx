'use client';
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "../../../../../../components/layout/AdminLayout";
import { mockApi } from "../../../../../../lib/mockApi";
import { Day, Event, Participant } from "../../../../../../lib/types";
import { Select } from "../../../../../../components/ui/Select";
import { Button } from "../../../../../../components/ui/Button";

type ViewMode = "full" | "day" | "participant";

export default function ItineraryPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("full");
  const [selectedDayId, setSelectedDayId] = useState<string>("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      mockApi.get<{ item: Event }>(`/events/${eventId}`),
      mockApi.get<{ items: Day[] }>(`/events/${eventId}/days`),
      mockApi.get<{ items: Participant[] }>("/participants"),
    ])
      .then(([e, d, p]) => {
        if (!mounted) return;
        setEvent(e.item);
        setDays(d.items);
        setParticipants(p.items);
        if (d.items.length > 0) setSelectedDayId(d.items[0].id);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [eventId]);

  const participantsInEvent = useMemo(() => {
    const blockIds = new Set<string>();
    for (const d of days) {
      if (d.blocks) {
        for (const b of d.blocks) blockIds.add(b.id);
      }
    }
    return participants.filter((p) => p.assignedBlockIds?.some((id) => blockIds.has(id)) ?? false);
  }, [days, participants]);

  const selectedDay = days.find((d) => d.id === selectedDayId) || null;
  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId) || null;

  const printExport = () => {
    window.print();
  };

  return (
    <AdminLayout title={event ? `${event.name} — Itinerary` : "Itinerary"}>
      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : !event ? (
        <div className="text-sm text-red-600">Event not found.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-zinc-600">
              {event.startDate} → {event.endDate}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={printExport}>
                Export PDF (mock)
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-white p-3">
            <div className="text-sm font-medium">View</div>
            <Select value={view} onChange={(e) => setView(e.target.value as ViewMode)} className="w-40">
              <option value="full">Full Event</option>
              <option value="day">By Day</option>
              <option value="participant">By Participant</option>
            </Select>
            {view === "day" ? (
              <Select value={selectedDayId} onChange={(e) => setSelectedDayId(e.target.value)} className="w-48">
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.date}
                  </option>
                ))}
              </Select>
            ) : null}
            {view === "participant" ? (
              <Select
                value={selectedParticipantId}
                onChange={(e) => setSelectedParticipantId(e.target.value)}
                className="w-64"
              >
                <option value="">Select participant…</option>
                {participantsInEvent.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({Array.isArray((p as any).roles) && (p as any).roles.length ? (p as any).roles.join(", ") : "—"})
                  </option>
                ))}
              </Select>
            ) : null}
          </div>

          {view === "full" ? (
            <div className="space-y-6">
              {days.map((d) => (
                <div key={d.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="mb-2 font-medium">{d.date}</div>
                  <div className="space-y-2">
                    {d.blocks?.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{b.title}</div>
                          <div className="text-xs text-zinc-600 truncate">{b.description}</div>
                        </div>
                        <div className="text-xs text-zinc-600">
                          {b.startTime}–{b.endTime}
                        </div>
                      </div>
                    )) ?? <div className="text-sm text-zinc-500">No blocks</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {view === "day" && selectedDay ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 font-medium">{selectedDay.date}</div>
              <div className="space-y-2">
                {selectedDay.blocks?.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.title}</div>
                      <div className="text-xs text-zinc-600 truncate">{b.description}</div>
                    </div>
                    <div className="text-xs text-zinc-600">
                      {b.startTime}–{b.endTime}
                    </div>
                  </div>
                )) ?? <div className="text-sm text-zinc-500">No blocks</div>}
              </div>
            </div>
          ) : null}

          {view === "participant" && selectedParticipant ? (
            <ParticipantItinerary participantId={selectedParticipant.id} />
          ) : null}
        </div>
      )}
    </AdminLayout>
  );
}

function ParticipantItinerary({ participantId }: { participantId: string }) {
  const [items, setItems] = useState<
    { eventId: string; dayId: string; date: string; block: { id: string; title: string; startTime: string; endTime: string; description?: string } }[]
  >([]);
  useEffect(() => {
    let mounted = true;
    mockApi.get<{ items: any[] }>(`/agenda/${participantId}`).then((res) => {
      if (!mounted) return;
      setItems(res.items);
    });
    return () => {
      mounted = false;
    };
  }, [participantId]);
  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.date] = acc[it.date] || []).push(it);
    return acc;
  }, {});
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, list]) => (
        <div key={date} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-2 font-medium">{date}</div>
          <div className="space-y-2">
            {list.map((it) => (
              <div key={`${it.dayId}-${it.block.id}`} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.block.title}</div>
                  <div className="text-xs text-zinc-600 truncate">{it.block.description}</div>
                </div>
                <div className="text-xs text-zinc-600">
                  {it.block.startTime}–{it.block.endTime}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}



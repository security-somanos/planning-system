'use client';
import { useEffect, useState } from "react";
import { mockApi } from "../../../lib/mockApi";
import { getSessionParticipantId } from "../../../lib/session";
import { Block } from "../../../lib/types";
import { calculateEndTime } from "../../../lib/blockUtils";
import { ParticipantLayout } from "../../../components/layout/ParticipantLayout";

type AgendaItem = {
  eventId: string;
  dayId: string;
  date: string;
  block: Block;
};

export default function ParticipantPortalPage() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const participantId = getSessionParticipantId();
    if (!participantId) return;
    setLoading(true);
    mockApi
      .get<{ items: AgendaItem[] }>(`/agenda/${participantId}`)
      .then((res) => {
        if (!mounted) return;
        setItems(res.items);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const grouped = items.reduce<Record<string, AgendaItem[]>>((acc, it) => {
    (acc[it.date] = acc[it.date] || []).push(it);
    return acc;
  }, {});

  return (
    <ParticipantLayout title="My Agenda">
      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-zinc-600">No items assigned.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, list]) => (
            <div key={date} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 font-medium">{date}</div>
              <div className="relative">
                <div className="absolute left-24 top-0 bottom-0 w-px bg-zinc-200" />
                <div className="space-y-4">
                  {list.map((it) => (
                    <div key={`${it.dayId}-${it.block.id}`} className="relative flex">
                      <div className="w-24 text-xs text-zinc-600 pt-1">
                        {(() => {
                          const endTime = calculateEndTime(it.block);
                          return endTime ? `${it.block.startTime}–${endTime}` : it.block.startTime;
                        })()}
                      </div>
                      <div className="ml-8 flex-1 rounded-md border border-zinc-200 p-3">
                        <div className="font-medium">{it.block.title}</div>
                        {it.block.description ? (
                          <div className="mt-1 text-sm text-zinc-700">{it.block.description}</div>
                        ) : null}
                        {Array.isArray((it.block as any).attachments) && (it.block as any).attachments.length > 0 ? (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-zinc-600">Attachments</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {(it.block as any).attachments.map((a: string, idx: number) => (
                                <a
                                  key={idx}
                                  href={a}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                                >
                                  {a}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ParticipantLayout>
  );
}
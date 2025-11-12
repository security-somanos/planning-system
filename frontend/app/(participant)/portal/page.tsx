'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Day } from "../../../lib/types";
import { ParticipantLayout } from "../../../components/layout/ParticipantLayout";

function formatDate(dateStr: string): { dayName: string; dayNum: string; month: string; year: string } {
  const d = new Date(dateStr + "T00:00:00");
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    dayName: dayNames[d.getDay()],
    dayNum: d.getDate().toString(),
    month: monthNames[d.getMonth()],
    year: d.getFullYear().toString(),
  };
}

function getTimeRange(blocks: Day["blocks"]): string {
  if (!blocks || blocks.length === 0) return "—";
  const times = blocks.map((b) => {
    const [h, m] = b.startTime.split(":").map(Number);
    return h * 60 + m;
  });
  const earliest = Math.min(...times);
  const latest = Math.max(...blocks.map((b) => {
    const endTime = b.endTime || b.startTime;
    const [h, m] = endTime.split(":").map(Number);
    return h * 60 + m;
  }));
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };
  return `${fmt(earliest)} - ${fmt(latest)}`;
}

export default function ParticipantPortalPage() {
  const { user } = useAuth();
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    
    let mounted = true;
    setLoading(true);
    setError("");
    
    // Fetch days - the API will automatically filter based on the authenticated user's participant
    api.get<{ items: Day[] }>('/days')
      .then((res) => {
        if (!mounted) return;
        setDays(res.items.sort((a, b) => a.date.localeCompare(b.date)));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load days');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <ParticipantLayout title="My Agenda">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Event Agenda</h1>
        <p className="text-sm text-zinc-600 mt-1">{days.length} {days.length === 1 ? "day" : "days"} scheduled</p>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : days.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <div className="text-zinc-600">No days scheduled yet</div>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const fmt = formatDate(d.date);
            const timeRange = getTimeRange(d.blocks);
            return (
              <Link
                key={d.id}
                href={`/portal/days/${d.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 text-center">
                    <div className="text-3xl font-bold text-zinc-900">{fmt.dayNum}</div>
                    <div className="text-xs font-medium text-zinc-600 uppercase tracking-wide">{fmt.month}</div>
                    <div className="text-xs text-zinc-500 mt-1">{fmt.year}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-semibold text-zinc-900 mb-1">{fmt.dayName}</div>
                    <div className="flex items-center gap-4 text-sm text-zinc-600">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                        {d.blocks?.length ?? 0} {(d.blocks?.length ?? 0) === 1 ? "block" : "blocks"}
                      </span>
                      {(d.blocks?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {timeRange}
                        </span>
                      )}
                    </div>
                    {(d.blocks?.length ?? 0) > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {d.blocks!.slice(0, 3).map((b) => (
                          <span
                            key={b.id}
                            className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                b.type === "activity"
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}
                            ></span>
                            {b.startTime} {b.title}
                          </span>
                        ))}
                        {(d.blocks?.length ?? 0) > 3 && (
                          <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500">
                            +{d.blocks!.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ParticipantLayout>
  );
}

'use client';
import { useEffect, useState } from "react";
import { mockApi } from "../../../lib/mockApi";
import { Day } from "../../../lib/types";
import Link from "next/link";
import { AdminLayout } from "../../../components/layout/AdminLayout";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";

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
    const [h, m] = b.endTime.split(":").map(Number);
    return h * 60 + m;
  }));
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };
  return `${fmt(earliest)} - ${fmt(latest)}`;
}

function generateDateRange(fromDate: string, toDate?: string): string[] {
  const dates: string[] = [];
  const endDateStr = toDate || fromDate;
  
  // Parse dates as YYYY-MM-DD strings to avoid timezone issues
  const [startYear, startMonth, startDay] = fromDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
  
  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);
  
  if (endDate < startDate) return [fromDate]; // Invalid range, just return single date
  
  const current = new Date(startDate);
  while (current <= endDate) {
    // Format as YYYY-MM-DD using local date components (no timezone conversion)
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

export default function AdminDashboardPage() {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addDayModalOpen, setAddDayModalOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    mockApi
      .get<{ items: Day[] }>("/days")
      .then((res) => {
        if (!mounted) return;
        setDays(res.items.sort((a, b) => a.date.localeCompare(b.date)));
      })
      .catch(() => {
        if (!mounted) return;
        setError("Failed to load days.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const addDay = async () => {
    if (!fromDate) return;
    setAdding(true);
    try {
      const dates = generateDateRange(fromDate, toDate || undefined);
      // Filter out dates that already exist
      const newDates = dates.filter((date) => !days.some((d) => d.date === date));
      
      if (newDates.length === 0) {
        alert("All selected dates already exist.");
        return;
      }
      
      // Send all dates in a single request
      const res = await mockApi.post<{ items: Day[] }>("/days", { dates: newDates });
      
      if (res.items && res.items.length > 0) {
        setDays((prev) => [...prev, ...res.items].sort((a, b) => a.date.localeCompare(b.date)));
      }
      
      setAddDayModalOpen(false);
      setFromDate("");
      setToDate("");
    } catch (err) {
      console.error("Failed to add days:", err);
      alert("Failed to add days. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const deleteDay = async (dayId: string, date: string) => {
    if (!confirm(`Delete day ${date}? This will remove all events for this day.`)) return;
    await mockApi.delete(`/days/${dayId}`);
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  console.log("days", days);

  return (
    <AdminLayout title="Agenda">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Event Agenda</h1>
          <p className="text-sm text-zinc-600 mt-1">{days.length} {days.length === 1 ? "day" : "days"} scheduled</p>
        </div>
        <Button onClick={() => setAddDayModalOpen(true)}>Add day</Button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : days.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <div className="text-zinc-600 mb-4">No days scheduled yet</div>
          <Button onClick={() => setAddDayModalOpen(true)}>Add your first day</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            console.log("d", d);
            const fmt = formatDate(d.date);
            const timeRange = getTimeRange(d.blocks);
            return (
              <div
                key={d.id}
                className="group rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md"
              >
                <Link href={`/admin/days/${d.id}`} className="block p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
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
                            {d.blocks?.length ?? 0} {(d.blocks?.length ?? 0) === 1 ? "event" : "events"}
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
                    <div className="shrink-0 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="danger"
                          onClick={(e) => {
                            e.preventDefault();
                            deleteDay(d.id, d.date);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={addDayModalOpen}
        onClose={() => {
          setAddDayModalOpen(false);
          setFromDate("");
          setToDate("");
        }}
        title="Add days"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAddDayModalOpen(false);
                setFromDate("");
                setToDate("");
              }}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button onClick={addDay} disabled={!fromDate || adding}>
              {adding ? "Adding…" : toDate ? "Add days" : "Add day"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium">From date</div>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">To date (optional)</div>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="Leave empty for single day"
              min={fromDate || undefined}
            />
            {toDate && fromDate && (
              <div className="mt-2 text-xs text-zinc-600">
                {generateDateRange(fromDate, toDate).length} {generateDateRange(fromDate, toDate).length === 1 ? "day" : "days"} will be added
              </div>
            )}
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}



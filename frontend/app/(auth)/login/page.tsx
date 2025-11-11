'use client';
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mockApi } from "../../../lib/mockApi";
import { loginAsAdmin, loginAsParticipant, getRole } from "../../../lib/session";
import { Button } from "../../../components/ui/Button";
import { Participant } from "../../../lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantId, setParticipantId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const r = getRole();
    if (r === "admin") router.replace("/admin");
    else if (r === "participant") router.replace("/portal");
  }, [router]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    mockApi
      .get<{ items: Participant[] }>("/participants")
      .then((res) => {
        if (!mounted) return;
        setParticipants(res.items);
        if (res.items.length > 0) setParticipantId(res.items[0].id);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Failed to load participants.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const onAdmin = () => {
    loginAsAdmin();
    router.replace("/admin");
  };
  const onParticipant = () => {
    if (!participantId) return;
    loginAsParticipant(participantId);
    router.replace("/portal");
  };

  const participantOptions = useMemo(
    () =>
      participants.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({Array.isArray((p as any).roles) && (p as any).roles.length ? (p as any).roles.join(", ") : "—"})
        </option>
      )),
    [participants]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Event & Trip Planning</h1>
        <p className="text-sm text-zinc-600 mb-6">
          Choose how you want to sign in (mock login).
        </p>

        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Admin</div>
                <div className="text-xs text-zinc-600">
                  Full control panel access
                </div>
              </div>
              <Button onClick={onAdmin}>Continue</Button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="mb-3">
              <div className="font-medium">Participant</div>
              <div className="text-xs text-zinc-600">
                See only your personal agenda
              </div>
            </div>
            {loading ? (
              <div className="text-sm text-zinc-600">Loading participants…</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  {participantOptions}
                </select>
                <Button onClick={onParticipant}>Continue</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



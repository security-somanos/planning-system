'use client';
import { useMemo, useRef, useState } from "react";
import { ParticipantLayout } from "@/components/layout/ParticipantLayout";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";

export default function ParticipantItineraryPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const pdfUrl = useMemo(() => {
    return `/api/export/user-pdf${refreshKey > 0 ? `?refresh=${refreshKey}` : ''}`;
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <ParticipantLayout title="Itinerary">
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button onClick={handleRefresh} variant="secondary" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="h-[calc(100vh-12rem)] w-full">
          <iframe
            ref={iframeRef}
            key={refreshKey}
            src={pdfUrl}
            className="h-full w-full"
            title="Itinerary PDF"
          />
        </div>
      </div>
    </ParticipantLayout>
  );
}


'use client';
import { useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";

// Get API URL from environment, remove trailing slash
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
};

export default function ItineraryPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const pdfUrl = useMemo(() => {
    const apiUrl = getApiUrl();
    return `${apiUrl}/export/pdf${refreshKey > 0 ? `?refresh=${refreshKey}` : ''}`;
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <AdminLayout title="Itinerary">
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
    </AdminLayout>
  );
}



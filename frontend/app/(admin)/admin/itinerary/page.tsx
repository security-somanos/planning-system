'use client';
import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";

export default function ItineraryPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Use Next.js API route that handles authentication
  const pdfUrl = useMemo(() => {
    return `/api/export/pdf${refreshKey > 0 ? `?refresh=${refreshKey}` : ''}`;
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



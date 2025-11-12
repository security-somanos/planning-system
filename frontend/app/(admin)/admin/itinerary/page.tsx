'use client';
import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";
import { getToken } from "@/lib/auth";

// Get API URL from environment, remove trailing slash
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
};

export default function ItineraryPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const loadPdf = async () => {
    setLoading(true);
    setError("");
    
    try {
      const apiUrl = getApiUrl();
      const token = getToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${apiUrl}/export/pdf${refreshKey > 0 ? `?refresh=${refreshKey}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please login again');
        }
        throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Clean up previous blob URL
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      
      setPdfBlobUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPdf();
  }, [refreshKey]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <AdminLayout title="Itinerary">
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button onClick={handleRefresh} variant="secondary" className="flex items-center gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {error ? (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : loading ? (
          <div className="h-[calc(100vh-12rem)] flex items-center justify-center text-sm text-zinc-600">
            Loading PDF...
          </div>
        ) : pdfBlobUrl ? (
          <div className="h-[calc(100vh-12rem)] w-full">
            <iframe
              ref={iframeRef}
              key={refreshKey}
              src={pdfBlobUrl}
              className="h-full w-full"
              title="Itinerary PDF"
            />
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}



'use client';
import { useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";

// Get API URL from environment, remove trailing slash
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
};

export default function ItineraryPage() {
  const pdfUrl = useMemo(() => {
    const apiUrl = getApiUrl();
    return `${apiUrl}/export/pdf`;
  }, []);

  return (
    <AdminLayout title="Itinerary">
      <div className="h-[calc(100vh-12rem)] w-full">
        <iframe
          src={pdfUrl}
          className="h-full w-full"
          title="Itinerary PDF"
        />
      </div>
    </AdminLayout>
  );
}



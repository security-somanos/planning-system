import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get API URL from environment
function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
}

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies (we'll set this from the client)
    const cookieStore = await cookies();
    const token = cookieStore.get('ps:auth:token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token found' },
        { status: 401 }
      );
    }

    const apiUrl = getApiUrl();
    const backendUrl = `${apiUrl}/export/pdf/my-itinerary`;
    
    // Forward the request to the backend API with authentication
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      // Important: don't cache the PDF
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid token' },
          { status: 401 }
        );
      }
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the PDF blob
    const blob = await response.blob();
    
    // Get content type from backend response
    const contentType = response.headers.get('content-type') || 'application/pdf';
    
    // Return the PDF with proper headers
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': response.headers.get('content-disposition') || 'inline; filename="itinerary.pdf"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error proxying PDF:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDF' },
      { status: 500 }
    );
  }
}


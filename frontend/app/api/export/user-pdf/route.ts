import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get API URL from environment, remove trailing slash
function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
}

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('ps:auth:token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get refresh query parameter if present
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get('refresh');
    const queryString = refresh ? `?refresh=${refresh}` : '';

    // Fetch PDF from backend API
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/export/user-pdf${queryString}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get PDF blob
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Return PDF with proper headers
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="itinerary.pdf"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


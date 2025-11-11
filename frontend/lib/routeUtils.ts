import { Location } from "./types";

/**
 * Extracts a place identifier from a Google Maps link.
 * Handles various Google Maps URL formats.
 */
function extractPlaceFromGoogleMapsLink(link?: string): string | null {
  if (!link) return null;
  
  try {
    const url = new URL(link);
    // Handle ?q= parameter (search query)
    if (url.searchParams.has("q")) {
      return url.searchParams.get("q");
    }
    // Handle place ID format: /maps/place/...
    const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    }
    // Handle coordinates: /maps/@lat,lng
    const coordMatch = url.pathname.match(/\/maps\/@([^,]+,[^/]+)/);
    if (coordMatch) {
      return coordMatch[1];
    }
  } catch {
    // If URL parsing fails, try to extract from the link string
    const qMatch = link.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      return decodeURIComponent(qMatch[1].replace(/\+/g, " "));
    }
  }
  
  return null;
}

/**
 * Generates a Google Maps directions URL between two locations.
 * Uses address if available, otherwise falls back to Google Maps link extraction.
 */
export function generateRouteUrl(from: Location, to: Location): string | null {
  const fromPlace = from.address || extractPlaceFromGoogleMapsLink(from.googleMapsLink) || from.name;
  const toPlace = to.address || extractPlaceFromGoogleMapsLink(to.googleMapsLink) || to.name;
  
  if (!fromPlace || !toPlace) return null;
  
  // Google Maps Directions URL format
  const params = new URLSearchParams({
    api: "1",
    origin: fromPlace,
    destination: toPlace,
  });
  
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Generates a Google Maps embed URL with directions.
 * Note: Requires a Google Maps API key. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.
 */
export function generateRouteEmbedUrl(from: Location, to: Location, apiKey?: string): string | null {
  if (!apiKey) return null;
  
  const fromPlace = from.address || extractPlaceFromGoogleMapsLink(from.googleMapsLink) || from.name;
  const toPlace = to.address || extractPlaceFromGoogleMapsLink(to.googleMapsLink) || to.name;
  
  if (!fromPlace || !toPlace) return null;
  
  // Google Maps Embed API with directions mode
  const params = new URLSearchParams({
    key: apiKey,
    origin: fromPlace,
    destination: toPlace,
    mode: "driving",
  });
  
  return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
}


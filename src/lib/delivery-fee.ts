/**
 * Delivery fee calculation — distance-based pricing.
 *
 * Strategy:
 *  1. If GOOGLE_MAPS_API_KEY is set → use Distance Matrix API (real road distance)
 *  2. Fallback → haversine formula (straight-line distance) × 1.3 (road factor)
 *
 * Pricing (configurable via env):
 *  BASE_FEE        = Rp 8.000 (first 2km)
 *  PER_KM_RATE     = Rp 2.000/km (after 2km)
 *  MAX_FEE         = Rp 30.000 (cap)
 *  MIN_FEE         = Rp 8.000 (minimum)
 *  FREE_DELIVERY_KM = 0 (set > 0 for free delivery within X km)
 *
 * Env:
 *  GOOGLE_MAPS_API_KEY — optional, enables Google Maps Distance Matrix
 *  REJO_DELIVERY_BASE_FEE — default 8000
 *  REJO_DELIVERY_PER_KM — default 2000
 *  REJO_DELIVERY_MAX_FEE — default 30000
 *  REJO_DELIVERY_FREE_KM — default 0
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const BASE_FEE = parseInt(process.env.REJO_DELIVERY_BASE_FEE || "8000", 10);
const PER_KM_RATE = parseInt(process.env.REJO_DELIVERY_PER_KM || "2000", 10);
const MAX_FEE = parseInt(process.env.REJO_DELIVERY_MAX_FEE || "30000", 10);
const FREE_DELIVERY_KM = parseFloat(process.env.REJO_DELIVERY_FREE_KM || "0");
const BASE_FEE_KM = 2; // first 2km included in base fee

export interface DeliveryEstimate {
  distanceKm: number;
  durationMin: number | null;
  fee: number;
  breakdown: {
    baseFee: number;
    perKmFee: number;
    total: number;
    capped: boolean;
    freeDelivery: boolean;
  };
  method: "google_maps" | "haversine";
}

export function isGoogleMapsEnabled(): boolean {
  return !!GOOGLE_MAPS_API_KEY;
}

/**
 * Geocode an address to lat/lng using Google Maps Geocoding API.
 * Returns null if API key not set or geocoding fails.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "OK" && data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get road distance + duration via Google Maps Distance Matrix API.
 * Returns null if API key not set or request fails.
 */
async function getGoogleMapsDistance(
  origin: string,
  destination: string,
): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_API_KEY}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
      const elem = data.rows[0].elements[0];
      return {
        distanceMeters: elem.distance.value,
        durationSeconds: elem.duration.value,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Haversine formula — straight-line distance between two lat/lng points.
 * Returns distance in km.
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate delivery fee from distance.
 *
 * Pricing logic:
 *  - 0 to BASE_FEE_KM km → BASE_FEE
 *  - After BASE_FEE_KM km → BASE_FEE + (extra_km × PER_KM_RATE)
 *  - Capped at MAX_FEE
 *  - Free if distance ≤ FREE_DELIVERY_KM (if > 0)
 */
function calculateFee(distanceKm: number): DeliveryEstimate["breakdown"] {
  // Free delivery?
  if (FREE_DELIVERY_KM > 0 && distanceKm <= FREE_DELIVERY_KM) {
    return {
      baseFee: 0,
      perKmFee: 0,
      total: 0,
      capped: false,
      freeDelivery: true,
    };
  }

  // Base fee covers first BASE_FEE_KM
  const baseFee = BASE_FEE;

  // Extra km after base
  const extraKm = Math.max(0, distanceKm - BASE_FEE_KM);
  const perKmFee = Math.round(extraKm * PER_KM_RATE);

  let total = baseFee + perKmFee;
  const capped = total > MAX_FEE;
  if (capped) total = MAX_FEE;

  return {
    baseFee,
    perKmFee,
    total,
    capped,
    freeDelivery: false,
  };
}

/**
 * Main entry: estimate delivery fee from merchant address to customer address.
 *
 * @param merchantAddress — restaurant address string
 * @param customerAddress — delivery address string
 * @param merchantLat/Lng — optional cached coordinates (from DB)
 * @returns DeliveryEstimate with distance, fee, breakdown, method
 */
export async function estimateDeliveryFee(
  merchantAddress: string,
  customerAddress: string,
  merchantLatLng?: { lat: number; lng: number } | null,
): Promise<DeliveryEstimate> {
  // Try Google Maps Distance Matrix first (most accurate)
  const gmapsResult = await getGoogleMapsDistance(merchantAddress, customerAddress);

  if (gmapsResult) {
    const distanceKm = gmapsResult.distanceMeters / 1000;
    const durationMin = Math.round(gmapsResult.durationSeconds / 60);
    const breakdown = calculateFee(distanceKm);

    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMin,
      fee: breakdown.total,
      breakdown,
      method: "google_maps",
    };
  }

  // Fallback: haversine (need lat/lng for both points)
  // Try geocoding if Google Maps API key is available
  let merchantCoords = merchantLatLng ?? null;
  let customerCoords: { lat: number; lng: number } | null = null;

  if (GOOGLE_MAPS_API_KEY) {
    // Geocode both addresses in parallel
    const [m, c] = await Promise.all([
      merchantCoords ? Promise.resolve(merchantCoords) : geocodeAddress(merchantAddress),
      geocodeAddress(customerAddress),
    ]);
    merchantCoords = m;
    customerCoords = c;
  }

  // If we have coordinates for both, use haversine
  if (merchantCoords && customerCoords) {
    const straightLineKm = haversineDistance(
      merchantCoords.lat, merchantCoords.lng,
      customerCoords.lat, customerCoords.lng,
    );
    // Road distance ≈ straight line × 1.3 (typical urban factor)
    const estimatedRoadKm = straightLineKm * 1.3;
    const breakdown = calculateFee(estimatedRoadKm);

    return {
      distanceKm: Math.round(estimatedRoadKm * 10) / 10,
      durationMin: null,
      fee: breakdown.total,
      breakdown,
      method: "haversine",
    };
  }

  // Last resort: flat fee (no distance data available)
  const breakdown = calculateFee(BASE_FEE_KM); // treat as base distance
  return {
    distanceKm: 0,
    durationMin: null,
    fee: BASE_FEE,
    breakdown: { ...breakdown, total: BASE_FEE },
    method: "haversine",
  };
}

/** Format fee for display. */
export function formatFee(fee: number): string {
  if (fee === 0) return "GRATIS";
  return "Rp " + fee.toLocaleString("id-ID");
}

/** Format distance for display. */
export function formatDistance(km: number): string {
  if (km === 0) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

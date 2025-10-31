/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance);
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Parse location string in "Lat,Lng" format
 */
export function parseLocation(location: string): { lat: number; lng: number } | null {
  if (!location) return null;
  
  const parts = location.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return null;
  }
  
  return { lat: parts[0], lng: parts[1] };
}

/**
 * Approximate geocoding for US ZIP codes (basic approximation)
 * In production, use a geocoding API
 */
export function getZipCodeCoordinates(zipCode: string): { lat: number; lng: number } | null {
  // Simplified ZIP code to coordinates mapping (major metros)
  const zipMap: Record<string, { lat: number; lng: number }> = {
    '10001': { lat: 40.7506, lng: -73.9971 }, // NYC
    '10002': { lat: 40.7158, lng: -73.9865 },
    '10003': { lat: 40.7316, lng: -73.9890 },
    '94102': { lat: 37.7796, lng: -122.4193 }, // SF
    '90001': { lat: 33.9731, lng: -118.2479 }, // LA
    '60601': { lat: 41.8857, lng: -87.6181 }, // Chicago
  };
  
  return zipMap[zipCode] || null;
}

/**
 * Calculate distance from farm to consumer
 */
export function calculateFarmToConsumerDistance(
  farmLocation: string,
  consumerZip: string
): number | null {
  const farmCoords = parseLocation(farmLocation);
  const consumerCoords = getZipCodeCoordinates(consumerZip);
  
  if (!farmCoords || !consumerCoords) return null;
  
  return calculateDistance(
    farmCoords.lat,
    farmCoords.lng,
    consumerCoords.lat,
    consumerCoords.lng
  );
}

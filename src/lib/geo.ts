/** Haversine — jarak meter antara dua koordinat GPS */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeoPoint = { latitude: number; longitude: number; radiusMeters: number; name: string };

export function findNearestOffice(
  lat: number,
  lng: number,
  offices: GeoPoint[]
): { office: GeoPoint; distanceM: number } | null {
  if (offices.length === 0) return null;
  let best: { office: GeoPoint; distanceM: number } | null = null;
  for (const office of offices) {
    const distanceM = distanceMeters(lat, lng, office.latitude, office.longitude);
    if (!best || distanceM < best.distanceM) {
      best = { office, distanceM };
    }
  }
  return best;
}

export function isWithinAnyOffice(lat: number, lng: number, offices: GeoPoint[]): GeoPoint | null {
  for (const office of offices) {
    const d = distanceMeters(lat, lng, office.latitude, office.longitude);
    if (d <= office.radiusMeters) return office;
  }
  return null;
}

/**
 * Generate points along a circle (for pathfinding / spawn radius).
 */
export function generateCirclePoints(
  lat: number,
  lng: number,
  radiusMeters: number,
  numPoints: number
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const R = 6378137; // Earth radius in meters
  const rad = radiusMeters / R;

  for (let i = 0; i < numPoints; i++) {
    const theta = (2 * Math.PI * i) / numPoints;
    const dLat = rad * Math.cos(theta);
    const dLng = rad * Math.sin(theta) / Math.cos((lat * Math.PI) / 180);
    points.push({
      lat: lat + (dLat * 180) / Math.PI,
      lng: lng + (dLng * 180) / Math.PI,
    });
  }
  return points;
}

/**
 * Haversine distance between two points in meters.
 */
export function getDistanceMeters(
  loc1: { lat: number; lon: number },
  loc2: { lat: number; lon: number }
): number {
  const R = 6371000; // radius of Earth in meters
  const φ1 = (loc1.lat * Math.PI) / 180;
  const φ2 = (loc2.lat * Math.PI) / 180;
  const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const Δλ = ((loc2.lon - loc1.lon) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

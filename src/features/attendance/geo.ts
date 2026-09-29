/**
 * P1-605: Haversine — jarak meter antar dua titik. Murni, diuji.
 * Privasi: app hanya menyimpan jarak + koordinat terpotong 3 desimal (~100 m).
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Potong koordinat ke 3 desimal sebelum disimpan. */
export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Grace period hadir tepat waktu (15 menit setelah mulai). */
export const ON_TIME_GRACE_MS = 15 * 60 * 1000;

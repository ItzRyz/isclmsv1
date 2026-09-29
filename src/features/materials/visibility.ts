/** Visibilitas tayang: PUBLISHED dan jadwal (bila ada) sudah lewat. */
export function isVisibleNow(material: {
  status: string;
  scheduled_at: string | null;
}): boolean {
  if (material.status !== "PUBLISHED") return false;
  if (!material.scheduled_at) return true;
  return new Date(material.scheduled_at).getTime() <= Date.now();
}

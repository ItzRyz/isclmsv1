import { z } from "zod";

const datetimeLocal = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Tanggal tidak valid",
  })
  .transform((v) => (v === "" ? null : new Date(v).toISOString()));

export const createSessionSchema = z
  .object({
    scope: z
      .string()
      .trim()
      .regex(/^(class|division):[0-9a-f-]{36}$/i, "Scope tidak valid"),
    name: z.string().trim().min(3).max(160),
    starts_at: datetimeLocal,
    ends_at: datetimeLocal,
    geofence_enabled: z.coerce.boolean(),
    latitude: z.coerce.number().min(-90).max(90).nullish(),
    longitude: z.coerce.number().min(-180).max(180).nullish(),
    radius_meters: z.coerce.number().int().positive().max(100000).nullish(),
  })
  .refine((v) => v.starts_at && v.ends_at && v.starts_at < v.ends_at, {
    message: "ends_at harus setelah starts_at",
  })
  .refine(
    (v) =>
      !v.geofence_enabled ||
      (v.latitude !== null &&
        v.latitude !== undefined &&
        v.longitude !== null &&
        v.longitude !== undefined &&
        !!v.radius_meters),
    "Geofence butuh latitude/longitude/radius",
  );

export const checkInSchema = z.object({
  session_id: z.string().uuid(),
  token: z.string().trim().min(8).max(256),
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
});

export const manualEntrySchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(["PRESENT", "LATE", "PERMITTED", "SICK", "ABSENT"]),
  reason: z.string().trim().max(1000).nullish(),
});

export const correctSchema = z.object({
  record_id: z.string().uuid(),
  new_status: z.enum(["PRESENT", "LATE", "PERMITTED", "SICK", "ABSENT"]),
  reason: z.string().trim().min(3).max(1000),
});

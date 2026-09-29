"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { haversineMeters, ON_TIME_GRACE_MS, roundCoord } from "./geo";
import {
  checkInSchema,
  correctSchema,
  createSessionSchema,
  manualEntrySchema,
} from "./schemas";

type Supa = Awaited<ReturnType<typeof createClient>>;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function qrPayload(sessionId: string, token: string): string {
  return JSON.stringify({ v: 1, sessionId, token });
}

/** P1-601: buat sesi (open_session). Satu dari class/division wajib diisi. */
export async function createSession(formData: FormData): Promise<void> {
  const parsed = createSessionSchema.safeParse({
    scope: formData.get("scope"),
    name: formData.get("name"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    geofence_enabled: formData.get("geofence_enabled") === "on",
    latitude: formData.get("latitude") || null,
    longitude: formData.get("longitude") || null,
    radius_meters: formData.get("radius_meters") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data sesi tidak valid");

  const { userId } = await requirePermission("attendance.open_session");
  const supabase = await createClient();
  const [kind, scopeId] = parsed.data.scope.split(":") as [
    "class" | "division",
    string,
  ];
  const { error } = await supabase.from("attendance_sessions").insert({
    class_id: kind === "class" ? scopeId : null,
    division_id: kind === "division" ? scopeId : null,
    name: parsed.data.name,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at,
    geofence_enabled: parsed.data.geofence_enabled,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    radius_meters: parsed.data.radius_meters,
    status: "OPEN",
    created_by: userId,
  });
  if (error) throw new Error(`Gagal membuat sesi: ${error.message}`);
  revalidatePath("/attendance");
}

export async function closeSession(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("session_id") ?? "");
  await requirePermission("attendance.open_session");
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ status: "CLOSED" })
    .eq("id", sessionId);
  if (error) throw new Error(`Gagal menutup sesi: ${error.message}`);
  revalidatePath(`/attendance/${sessionId}`);
}

export async function reopenSession(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("session_id") ?? "");
  await requirePermission("attendance.open_session");
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ status: "OPEN" })
    .eq("id", sessionId);
  if (error) throw new Error(`Gagal membuka sesi: ${error.message}`);
  revalidatePath(`/attendance/${sessionId}`);
}

/**
 * P1-602: terbitkan token sesi baru (hash disimpan, token mentah ke QR).
 * Token hanya valid selama sesi OPEN dalam jendela waktu.
 */
export async function issueSessionToken(
  sessionId: string,
): Promise<{ payload: string }> {
  await requirePermission("attendance.open_session");
  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ session_token_hash: hashToken(token) })
    .eq("id", sessionId)
    .eq("status", "OPEN");
  if (error) throw new Error(`Gagal menerbitkan token: ${error.message}`);
  return { payload: qrPayload(sessionId, token) };
}

/** Render QR sesi sebagai dataURL (dipakai tampilan + rotasi). */
export async function renderSessionQr(
  sessionId: string,
): Promise<{ img: string }> {
  const { payload } = await issueSessionToken(sessionId);
  const img = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
  return { img };
}

async function loadOpenSession(supa: Supa, sessionId: string) {
  const { data: session } = await supa
    .from("attendance_sessions")
    .select(
      "id, status, starts_at, ends_at, geofence_enabled, latitude, longitude, radius_meters, session_token_hash",
    )
    .eq("id", sessionId)
    .single();
  if (!session) throw new Error("NOT_FOUND: sesi tidak ada");
  if (session.status !== "OPEN")
    throw new Error("ATTENDANCE_CLOSED: sesi ditutup");
  const now = Date.now();
  if (now < new Date(session.starts_at as string).getTime()) {
    throw new Error("ATTENDANCE_CLOSED: sesi belum mulai");
  }
  if (now > new Date(session.ends_at as string).getTime()) {
    throw new Error("ATTENDANCE_CLOSED: sesi sudah berakhir");
  }
  return session as {
    id: string;
    starts_at: string;
    geofence_enabled: boolean;
    latitude: number | null;
    longitude: number | null;
    radius_meters: number | null;
    session_token_hash: string | null;
  };
}

/**
 * P1-602/605: check-in mandiri via QR — token + jendela + geofence,
 * duplikat ditolak (unique session+user). Status PRESENT/LATE dari server.
 */
export async function checkIn(input: {
  session_id: string;
  token: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ status: string }> {
  const parsed = checkInSchema.safeParse({
    session_id: input.session_id,
    token: input.token,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const session = await loadOpenSession(supabase, parsed.data.session_id);
  if (
    !session.session_token_hash ||
    hashToken(parsed.data.token) !== session.session_token_hash
  ) {
    throw new Error("FORBIDDEN: token sesi tidak valid");
  }

  let distance: number | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  if (session.geofence_enabled) {
    if (
      parsed.data.latitude === null ||
      parsed.data.latitude === undefined ||
      parsed.data.longitude === null ||
      parsed.data.longitude === undefined
    ) {
      throw new Error("GEOFENCE_FAILED: lokasi wajib diaktifkan");
    }
    if (
      session.latitude === null ||
      session.longitude === null ||
      !session.radius_meters
    ) {
      throw new Error("GEOFENCE_FAILED: geofence sesi belum dikonfigurasi");
    }
    distance = haversineMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      session.latitude,
      session.longitude,
    );
    if (distance > session.radius_meters) {
      throw new Error(
        `GEOFENCE_FAILED: di luar radius (${Math.round(distance)} m)`,
      );
    }
    lat = roundCoord(parsed.data.latitude);
    lng = roundCoord(parsed.data.longitude);
  }

  const late =
    Date.now() > new Date(session.starts_at).getTime() + ON_TIME_GRACE_MS;
  const { error } = await supabase.from("attendance_records").insert({
    attendance_session_id: session.id,
    user_id: user.id,
    status: late ? "LATE" : "PRESENT",
    method: "QR_SCAN",
    latitude: lat,
    longitude: lng,
    distance_meters: distance,
    source_metadata: { geofence: session.geofence_enabled },
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("CONFLICT: sudah check-in sesi ini");
    throw new Error(`Gagal check-in: ${error.message}`);
  }
  revalidatePath(`/attendance/${session.id}`);
  return { status: late ? "LATE" : "PRESENT" };
}

/**
 * P1-603/604: scan kartu anggota oleh mentor — tanpa token sesi
 * (kehadiran fisik via kartu), tetap validasi jendela sesi.
 */
export async function idCardCheckIn(input: {
  session_id: string;
  member_user_id: string;
}): Promise<{ status: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_user_id: user.id,
    p_permission_code: "attendance.correct",
  });
  if (!allowed) throw new Error("FORBIDDEN: butuh attendance.correct");
  const session = await loadOpenSession(supabase, input.session_id);

  const late =
    Date.now() > new Date(session.starts_at).getTime() + ON_TIME_GRACE_MS;
  const { error } = await supabase.from("attendance_records").insert({
    attendance_session_id: session.id,
    user_id: input.member_user_id,
    status: late ? "LATE" : "PRESENT",
    method: "ID_CARD_SCAN",
    source_metadata: { scanned_by: user.id },
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("CONFLICT: anggota sudah tercatat");
    throw new Error(`Gagal mencatat: ${error.message}`);
  }
  revalidatePath(`/attendance/${session.id}`);
  return { status: late ? "LATE" : "PRESENT" };
}

/** P1-606: entri manual (izin/sakit/alpa/hadir susulan) + alasan. */
export async function manualEntry(formData: FormData): Promise<void> {
  const parsed = manualEntrySchema.safeParse({
    session_id: formData.get("session_id"),
    user_id: formData.get("user_id"),
    status: formData.get("status"),
    reason: formData.get("reason") || null,
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const { userId } = await requirePermission("attendance.correct");
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("id", parsed.data.session_id)
    .single();
  if (!session) throw new Error("NOT_FOUND: sesi tidak ada");
  const { error } = await supabase.from("attendance_records").insert({
    attendance_session_id: parsed.data.session_id,
    user_id: parsed.data.user_id,
    status: parsed.data.status,
    method: "MANUAL",
    source_metadata: { reason: parsed.data.reason, by: userId },
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("CONFLICT: sudah ada record, gunakan koreksi");
    throw new Error(`Gagal entri manual: ${error.message}`);
  }
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "attendance.manual",
    entity_type: "attendance_records",
    entity_id: parsed.data.user_id,
    new_values: { status: parsed.data.status, reason: parsed.data.reason },
  });
  revalidatePath(`/attendance/${parsed.data.session_id}`);
}

/** P1-607: koreksi teraudit (trigger update + baris koreksi + audit). */
export async function correctRecord(formData: FormData): Promise<void> {
  const parsed = correctSchema.safeParse({
    record_id: formData.get("record_id"),
    new_status: formData.get("new_status"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const { userId } = await requirePermission("attendance.correct");
  const supabase = await createClient();
  const { data: record } = await supabase
    .from("attendance_records")
    .select("id, status, attendance_session_id")
    .eq("id", parsed.data.record_id)
    .single();
  if (!record) throw new Error("NOT_FOUND");
  if (record.status === parsed.data.new_status) {
    throw new Error("VALIDATION_ERROR: status tidak berubah");
  }
  const { error } = await supabase
    .from("attendance_records")
    .update({ status: parsed.data.new_status })
    .eq("id", parsed.data.record_id);
  if (error) throw new Error(`Gagal koreksi: ${error.message}`);
  const { error: corrError } = await supabase
    .from("attendance_corrections")
    .insert({
      attendance_record_id: parsed.data.record_id,
      old_status: record.status as string,
      new_status: parsed.data.new_status,
      reason: parsed.data.reason,
      corrected_by: userId,
    });
  if (corrError)
    throw new Error(`Gagal mencatat koreksi: ${corrError.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "attendance.correct",
    entity_type: "attendance_records",
    entity_id: parsed.data.record_id,
    old_values: { status: record.status },
    new_values: { status: parsed.data.new_status, reason: parsed.data.reason },
  });
  revalidatePath(`/attendance/${record.attendance_session_id as string}`);
}

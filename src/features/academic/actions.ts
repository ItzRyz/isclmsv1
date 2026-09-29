"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  createBatchSchema,
  createPeriodSchema,
  updateBatchSchema,
  updatePeriodSchema,
} from "./schemas";

/** Izin tulis akademik mengikuti RLS (periods_write/batches_write: class.create). */
async function requireAcademicWrite() {
  return requirePermission("class.create");
}

async function orgId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "study-club")
    .single();
  if (!data) throw new Error("Organisasi belum ada.");
  return data.id as string;
}

export async function createBatch(formData: FormData): Promise<void> {
  const parsed = createBatchSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data batch tidak valid");
  await requireAcademicWrite();
  const supabase = await createClient();
  const { error } = await supabase.from("batches").insert({
    ...parsed.data,
    organization_id: await orgId(),
    status: "ACTIVE",
  });
  if (error) throw new Error(`Gagal membuat batch: ${error.message}`);
  revalidatePath("/academic");
}

export async function updateBatch(formData: FormData): Promise<void> {
  const parsed = updateBatchSchema.safeParse({
    batch_id: formData.get("batch_id"),
    name: formData.get("name"),
    code: formData.get("code"),
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data batch tidak valid");
  await requireAcademicWrite();
  const supabase = await createClient();
  const { batch_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("batches")
    .update(rest)
    .eq("id", batch_id);
  if (error) throw new Error(`Gagal mengubah batch: ${error.message}`);
  revalidatePath("/academic");
}

export async function deleteBatch(formData: FormData): Promise<void> {
  await requireAcademicWrite();
  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .delete()
    .eq("id", String(formData.get("batch_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus batch: ${error.message}`);
  revalidatePath("/academic");
}

export async function createPeriod(formData: FormData): Promise<void> {
  const parsed = createPeriodSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data periode tidak valid");
  await requireAcademicWrite();
  const supabase = await createClient();
  const { error } = await supabase.from("academic_periods").insert({
    ...parsed.data,
    organization_id: await orgId(),
    status: "ACTIVE",
  });
  if (error) throw new Error(`Gagal membuat periode: ${error.message}`);
  revalidatePath("/academic");
}

export async function updatePeriod(formData: FormData): Promise<void> {
  const parsed = updatePeriodSchema.safeParse({
    period_id: formData.get("period_id"),
    name: formData.get("name"),
    code: formData.get("code"),
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data periode tidak valid");
  await requireAcademicWrite();
  const supabase = await createClient();
  const { period_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("academic_periods")
    .update(rest)
    .eq("id", period_id);
  if (error) throw new Error(`Gagal mengubah periode: ${error.message}`);
  revalidatePath("/academic");
}

/** Satu periode ACTIVE per organisasi: aktifkan target, nonaktifkan sisanya. */
export async function setActivePeriod(formData: FormData): Promise<void> {
  const periodId = String(formData.get("period_id") ?? "");
  await requireAcademicWrite();
  const supabase = await createClient();
  const org = await orgId();
  const { error: offError } = await supabase
    .from("academic_periods")
    .update({ status: "INACTIVE" })
    .eq("organization_id", org)
    .eq("status", "ACTIVE");
  if (offError)
    throw new Error(`Gagal menonaktifkan periode lain: ${offError.message}`);
  const { error: onError } = await supabase
    .from("academic_periods")
    .update({ status: "ACTIVE" })
    .eq("id", periodId);
  if (onError)
    throw new Error(`Gagal mengaktifkan periode: ${onError.message}`);
  revalidatePath("/academic");
}

export async function deletePeriod(formData: FormData): Promise<void> {
  await requireAcademicWrite();
  const supabase = await createClient();
  const { error } = await supabase
    .from("academic_periods")
    .delete()
    .eq("id", String(formData.get("period_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus periode: ${error.message}`);
  revalidatePath("/academic");
}

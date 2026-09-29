"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  classMemberSchema,
  createClassSchema,
  updateClassSchema,
} from "./schemas";

export async function createClass(formData: FormData): Promise<void> {
  const parsed = createClassSchema.safeParse({
    division_id: formData.get("division_id"),
    batch_id: formData.get("batch_id") ?? "",
    academic_period_id: formData.get("academic_period_id") ?? "",
    name: formData.get("name"),
    code: formData.get("code"),
    capacity: formData.get("capacity") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data kelas tidak valid");

  await requirePermission("class.create");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({ ...parsed.data, status: "ACTIVE" })
    .select("id")
    .single();
  if (error) throw new Error(`Gagal membuat kelas: ${error.message}`);
  revalidatePath("/classes");
  void data;
}

export async function updateClass(formData: FormData): Promise<void> {
  const parsed = updateClassSchema.safeParse({
    class_id: formData.get("class_id"),
    name: formData.get("name"),
    capacity: formData.get("capacity") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data kelas tidak valid");

  await requirePermission("class.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.class_id);
  if (error) throw new Error(`Gagal mengubah kelas: ${error.message}`);
  revalidatePath(`/classes/${parsed.data.class_id}`);
}

export async function deleteClass(formData: FormData): Promise<void> {
  const classId = String(formData.get("class_id") ?? "");
  await requirePermission("class.delete");
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) throw new Error(`Gagal menghapus kelas: ${error.message}`);
  revalidatePath("/classes");
}

export async function addClassMember(formData: FormData): Promise<void> {
  const parsed = classMemberSchema.safeParse({
    class_id: formData.get("class_id"),
    user_id: formData.get("user_id"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data anggota tidak valid");

  await requirePermission("member.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("class_members").upsert(
    {
      class_id: parsed.data.class_id,
      user_id: parsed.data.user_id,
      left_at: null,
      status: "ACTIVE",
    },
    { onConflict: "class_id,user_id" },
  );
  if (error) throw new Error(`Gagal menambah anggota kelas: ${error.message}`);
  revalidatePath(`/classes/${parsed.data.class_id}`);
}

export async function removeClassMember(formData: FormData): Promise<void> {
  const parsed = classMemberSchema.safeParse({
    class_id: formData.get("class_id"),
    user_id: formData.get("user_id"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data anggota tidak valid");

  await requirePermission("member.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_members")
    .update({ left_at: new Date().toISOString(), status: "INACTIVE" })
    .eq("class_id", parsed.data.class_id)
    .eq("user_id", parsed.data.user_id);
  if (error) throw new Error(`Gagal mengeluarkan anggota: ${error.message}`);
  revalidatePath(`/classes/${parsed.data.class_id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { accountSchema, categorySchema } from "./schemas";

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

export async function createAccount(formData: FormData): Promise<void> {
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    type: formData.get("type"),
    opening_balance: formData.get("opening_balance"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data akun tidak valid");

  await requirePermission("finance.create");
  const supabase = await createClient();
  const { error } = await supabase.from("financial_accounts").insert({
    ...parsed.data,
    organization_id: await orgId(),
  });
  if (error) throw new Error(`Gagal membuat akun: ${error.message}`);
  revalidatePath("/finance");
}

export async function toggleAccount(formData: FormData): Promise<void> {
  await requirePermission("finance.update");
  const supabase = await createClient();
  const { data: acc } = await supabase
    .from("financial_accounts")
    .select("id, is_active")
    .eq("id", String(formData.get("account_id") ?? ""))
    .single();
  if (!acc) throw new Error("NOT_FOUND");
  const { error } = await supabase
    .from("financial_accounts")
    .update({ is_active: !(acc as { is_active: boolean }).is_active })
    .eq("id", String(formData.get("account_id") ?? ""));
  if (error) throw new Error(`Gagal mengubah akun: ${error.message}`);
  revalidatePath("/finance");
}

export async function createCategory(formData: FormData): Promise<void> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data kategori tidak valid");

  await requirePermission("finance.create");
  const supabase = await createClient();
  const { error } = await supabase.from("financial_categories").insert({
    ...parsed.data,
    organization_id: await orgId(),
  });
  if (error) {
    if (error.code === "23505") throw new Error("CONFLICT: kategori sudah ada");
    throw new Error(`Gagal membuat kategori: ${error.message}`);
  }
  revalidatePath("/finance");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requirePermission("finance.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_categories")
    .delete()
    .eq("id", String(formData.get("category_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus kategori: ${error.message}`);
  revalidatePath("/finance");
}

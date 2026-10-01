"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "./txn-schemas";

export async function recordTransaction(formData: FormData): Promise<void> {
  const parsed = transactionSchema.safeParse({
    account_id: formData.get("account_id"),
    category_id: formData.get("category_id") || null,
    type: formData.get("type"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    transaction_date: formData.get("transaction_date") || null,
    reference: formData.get("reference") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data transaksi tidak valid");

  const { userId } = await requirePermission("finance.create");
  const supabase = await createClient();
  if (parsed.data.category_id) {
    const { data: cat } = await supabase
      .from("financial_categories")
      .select("kind")
      .eq("id", parsed.data.category_id)
      .single();
    const kind = (cat as { kind: string } | null)?.kind;
    if (kind && kind !== parsed.data.type) {
      throw new Error("VALIDATION_ERROR: kategori tidak sesuai tipe transaksi");
    }
  }
  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({
      ...parsed.data,
      transaction_date:
        parsed.data.transaction_date ?? new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Gagal mencatat transaksi: ${error?.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "finance.transaction_create",
    entity_type: "financial_transactions",
    entity_id: (data as { id: string }).id,
    new_values: {
      type: parsed.data.type,
      amount: parsed.data.amount,
      account_id: parsed.data.account_id,
    },
  });
  revalidatePath("/finance/transactions");
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const { userId } = await requirePermission("finance.delete");
  const supabase = await createClient();
  const txnId = String(formData.get("transaction_id") ?? "");
  const { data: old } = await supabase
    .from("financial_transactions")
    .select("id, type, amount, account_id")
    .eq("id", txnId)
    .single();
  if (!old) throw new Error("NOT_FOUND");
  const { error } = await supabase
    .from("financial_transactions")
    .delete()
    .eq("id", txnId);
  if (error) throw new Error(`Gagal menghapus transaksi: ${error.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "finance.transaction_delete",
    entity_type: "financial_transactions",
    entity_id: txnId,
    old_values: old as Record<string, unknown>,
  });
  revalidatePath("/finance/transactions");
}

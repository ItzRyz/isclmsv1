"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const dueSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(1000000000000),
  period_label: z.string().trim().min(2).max(64),
  note: z.string().trim().max(500).nullish(),
});

const paySchema = z.object({
  payment_id: z.string().uuid(),
  account_id: z.string().uuid(),
  method: z.string().trim().max(64).nullish(),
});

type Supa = Awaited<ReturnType<typeof createClient>>;

async function orgId(supa: Supa): Promise<string> {
  const { data } = await supa
    .from("organizations")
    .select("id")
    .eq("slug", "study-club")
    .single();
  if (!data) throw new Error("Organisasi belum ada.");
  return (data as { id: string }).id;
}

async function ensureDuesCategory(supa: Supa): Promise<string> {
  const org = await orgId(supa);
  const { data: existing } = await supa
    .from("financial_categories")
    .select("id")
    .eq("organization_id", org)
    .eq("name", "Iuran Anggota")
    .single();
  if (existing) return (existing as { id: string }).id;
  const { data, error } = await supa
    .from("financial_categories")
    .insert({ organization_id: org, name: "Iuran Anggota", kind: "INCOME" })
    .select("id")
    .single();
  if (error || !data) throw new Error("Gagal membuat kategori iuran");
  return (data as { id: string }).id;
}

export async function recordDue(formData: FormData): Promise<void> {
  const parsed = dueSchema.safeParse({
    user_id: formData.get("user_id"),
    amount: formData.get("amount"),
    period_label: formData.get("period_label"),
    note: formData.get("note") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data iuran tidak valid");

  const { userId } = await requirePermission("finance.create");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    ...parsed.data,
    status: "PENDING",
    recorded_by: userId,
  });
  if (error) throw new Error(`Gagal mencatat iuran: ${error.message}`);
  revalidatePath("/finance/payments");
}

/**
 * Tandai lunas + rekonsiliasi: buat transaksi INCOME terhubung.
 * Idempoten (payment yang sudah PAID ditolak).
 */
export async function markPaid(formData: FormData): Promise<void> {
  const parsed = paySchema.safeParse({
    payment_id: formData.get("payment_id"),
    account_id: formData.get("account_id"),
    method: formData.get("method") || null,
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  const { userId } = await requirePermission("finance.create");
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, amount, period_label, status")
    .eq("id", parsed.data.payment_id)
    .single();
  if (!payment) throw new Error("NOT_FOUND");
  const p = payment as {
    user_id: string;
    amount: number;
    period_label: string;
    status: string;
  };
  if (p.status === "PAID") throw new Error("CONFLICT: sudah lunas");

  const categoryId = await ensureDuesCategory(supabase);
  const { data: txn, error: txnError } = await supabase
    .from("financial_transactions")
    .insert({
      account_id: parsed.data.account_id,
      category_id: categoryId,
      type: "INCOME",
      amount: p.amount,
      description: `Iuran ${p.period_label}`,
      created_by: userId,
    })
    .select("id")
    .single();
  if (txnError || !txn)
    throw new Error(`Gagal membuat transaksi: ${txnError?.message}`);
  const { error } = await supabase
    .from("payments")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      method: parsed.data.method,
      transaction_id: (txn as { id: string }).id,
    })
    .eq("id", parsed.data.payment_id)
    .eq("status", "PENDING");
  if (error) throw new Error(`Gagal menandai lunas: ${error.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "finance.payment_paid",
    entity_type: "payments",
    entity_id: parsed.data.payment_id,
    new_values: {
      amount: p.amount,
      transaction_id: (txn as { id: string }).id,
    },
  });
  revalidatePath("/finance/payments");
}

export async function cancelDue(formData: FormData): Promise<void> {
  const { userId } = await requirePermission("finance.update");
  const supabase = await createClient();
  const paymentId = String(formData.get("payment_id") ?? "");
  const { error } = await supabase
    .from("payments")
    .update({ status: "CANCELLED" })
    .eq("id", paymentId)
    .eq("status", "PENDING");
  if (error) throw new Error(`Gagal membatalkan: ${error.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "finance.payment_cancel",
    entity_type: "payments",
    entity_id: paymentId,
  });
  revalidatePath("/finance/payments");
}

"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { awardSchema } from "./schemas";

/**
 * Beri poin (positif/negatif). Koreksi = transaksi kompensasi baru,
 * bukan ubah/hapus riwayat (RLS menolak UPDATE/DELETE).
 */
export async function awardPoints(formData: FormData): Promise<void> {
  const parsed = awardSchema.safeParse({
    user_id: formData.get("user_id"),
    amount: formData.get("amount"),
    point_type: formData.get("point_type"),
    source_type: formData.get("source_type"),
    source_id: formData.get("source_id") || null,
    description: formData.get("description"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data poin tidak valid");

  const { userId } = await requirePermission("point.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("point_transactions").insert({
    ...parsed.data,
    created_by: userId,
  });
  if (error) throw new Error(`Gagal memberi poin: ${error.message}`);
  revalidatePath("/points");
}

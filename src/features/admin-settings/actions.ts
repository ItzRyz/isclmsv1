"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const settingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9_.]+$/, "Key huruf kecil/angka/titik/underscore"),
  value: z.string().trim().min(2).max(10000),
});

export async function saveSetting(formData: FormData): Promise<void> {
  const parsed = settingSchema.safeParse({
    key: formData.get("key"),
    value: formData.get("value"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: key/value tidak valid");
  let json: unknown;
  try {
    json = JSON.parse(parsed.data.value) as unknown;
  } catch {
    throw new Error("VALIDATION_ERROR: value harus JSON valid");
  }

  const { userId } = await requirePermission("settings.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("system_settings").upsert({
    key: parsed.data.key,
    value: json as Record<string, unknown>,
    updated_by: userId,
  });
  if (error) throw new Error(`Gagal menyimpan: ${error.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "settings.update",
    entity_type: "system_settings",
    entity_id: parsed.data.key,
    new_values: json as Record<string, unknown>,
  });
  revalidatePath("/admin/settings");
}

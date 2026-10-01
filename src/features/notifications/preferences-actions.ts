"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const prefSchema = z.object({
  event_type: z.string().trim().min(2).max(64),
  in_app: z.coerce.boolean(),
  email: z.coerce.boolean(),
});

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export async function savePreference(formData: FormData): Promise<void> {
  const parsed = prefSchema.safeParse({
    event_type: formData.get("event_type"),
    in_app: formData.get("in_app") === "on",
    email: formData.get("email") === "on",
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      event_type: parsed.data.event_type,
      in_app_enabled: parsed.data.in_app,
      email_enabled: parsed.data.email,
    },
    { onConflict: "user_id,event_type" },
  );
  if (error) throw new Error(`Gagal menyimpan preferensi: ${error.message}`);
  revalidatePath("/notifications/preferences");
}

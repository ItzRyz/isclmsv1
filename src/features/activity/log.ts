import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVITY_TYPES = [
  "material.view",
  "material.complete",
  "material.uncomplete",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export async function logActivity(
  supabase: SupabaseClient,
  input: {
    userId: string;
    type: ActivityType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("learning_activities").insert({
    user_id: input.userId,
    activity_type: input.type,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`Gagal mencatat aktivitas: ${error.message}`);
}

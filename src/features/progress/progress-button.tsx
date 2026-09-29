import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { completeMaterial, uncompleteMaterial } from "./actions";

export async function ProgressButton({ materialId }: { materialId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prog } = await supabase
    .from("material_progress")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("material_id", materialId)
    .single();
  const done = !!prog?.completed_at;

  return done ? (
    <form action={uncompleteMaterial}>
      <input type="hidden" name="material_id" value={materialId} />
      <Button type="submit" size="sm" variant="secondary">
        ✓ Selesai — batalkan?
      </Button>
    </form>
  ) : (
    <form action={completeMaterial}>
      <input type="hidden" name="material_id" value={materialId} />
      <Button type="submit" size="sm">
        Tandai selesai
      </Button>
    </form>
  );
}

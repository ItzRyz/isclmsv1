import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { toggleBookmark } from "./actions";

export async function BookmarkButton({ materialId }: { materialId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: marked } = await supabase
    .from("material_bookmarks")
    .select("material_id")
    .eq("user_id", user.id)
    .eq("material_id", materialId)
    .single();

  return (
    <form action={toggleBookmark}>
      <input type="hidden" name="material_id" value={materialId} />
      <Button type="submit" size="sm" variant={marked ? "default" : "outline"}>
        {marked ? "★ Tersimpan" : "☆ Simpan"}
      </Button>
    </form>
  );
}

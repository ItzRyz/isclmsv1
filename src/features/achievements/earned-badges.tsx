import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

/** Lencana milik user untuk halaman profil. */
export async function EarnedBadges({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("user_achievements")
    .select("awarded_at, achievements(name, icon)")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false })
    .limit(12);
  const list = (rows ?? []) as unknown as {
    awarded_at: string;
    achievements:
      { name: string; icon: string } | { name: string; icon: string }[] | null;
  }[];
  if (list.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">Belum ada lencana.</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((r, i) => {
        const a = Array.isArray(r.achievements)
          ? r.achievements[0]
          : r.achievements;
        return (
          <Badge
            key={i}
            variant="secondary"
            title={new Date(r.awarded_at).toLocaleDateString("id-ID")}
          >
            {a?.icon} {a?.name}
          </Badge>
        );
      })}
    </div>
  );
}

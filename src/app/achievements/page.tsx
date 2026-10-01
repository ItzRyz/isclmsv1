import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { checkMyAchievements } from "@/features/achievements/actions";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: all } = await supabase
    .from("achievements")
    .select("id, code, name, description, icon")
    .eq("status", "ACTIVE")
    .order("name");
  const { data: mine } = user
    ? await supabase
        .from("user_achievements")
        .select("achievement_id, awarded_at")
        .eq("user_id", user.id)
    : { data: [] as unknown[] };
  const earned = new Map(
    ((mine ?? []) as { achievement_id: string; awarded_at: string }[]).map(
      (m) => [m.achievement_id, m.awarded_at],
    ),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Pencapaian ({earned.size}/{((all ?? []) as unknown[]).length})
        </h1>
        {user ? (
          <form action={checkMyAchievements}>
            <Button type="submit" size="sm" variant="outline">
              Periksa pencapaianku
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          (all ?? []) as {
            id: string;
            code: string;
            name: string;
            description: string | null;
            icon: string;
          }[]
        ).map((a) => {
          const at = earned.get(a.id);
          return (
            <Card key={a.id} className={at ? "" : "opacity-60"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-2xl">{a.icon}</span>
                  {a.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{a.description}</span>
                {at ? (
                  <Badge variant="secondary">
                    Diraih {new Date(at).toLocaleDateString("id-ID")}
                  </Badge>
                ) : (
                  <Badge variant="outline">Belum diraih</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

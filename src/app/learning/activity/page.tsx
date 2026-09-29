import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

const LABELS: Record<string, string> = {
  "material.view": "Melihat materi",
  "material.complete": "Menyelesaikan materi",
  "material.uncomplete": "Membatalkan selesai",
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Riwayat belajar</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Masuk dulu untuk melihat riwayat.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: items } = await supabase
    .from("learning_activities")
    .select("id, activity_type, entity_type, entity_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Riwayat belajar</h1>
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6 text-sm">
          {(
            (items ?? []) as {
              id: string;
              activity_type: string;
              created_at: string;
            }[]
          ).map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <Badge variant="outline">
                {LABELS[a.activity_type] ?? a.activity_type}
              </Badge>
              <span className="text-muted-foreground ml-auto">
                {new Date(a.created_at).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
          {(items ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada aktivitas.</span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

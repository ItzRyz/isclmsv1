import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  addParticipant,
  deleteCompetition,
  recordResult,
} from "@/features/competitions/actions";

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: comp } = await supabase
    .from("competitions")
    .select("id, name, description, status")
    .eq("id", id)
    .single();
  if (!comp) notFound();

  const { data: parts } = await supabase
    .from("competition_participants")
    .select("user_id, status, rank, score, points_awarded, profiles(full_name)")
    .eq("competition_id", id)
    .order("rank", { nullsFirst: true });
  const manageable = await can("event.update").catch(() => false);
  const canDelete = await can("event.delete").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {comp.name} <Badge>{comp.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {comp.description ?? "Tanpa deskripsi."}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Peserta & hasil ({((parts ?? []) as unknown[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {(
            (parts ?? []) as unknown as {
              user_id: string;
              status: string;
              rank: number | null;
              score: number | null;
              points_awarded: number;
              profiles:
                | { full_name: string | null }
                | { full_name: string | null }[]
                | null;
            }[]
          ).map((p) => {
            const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            return (
              <div
                key={p.user_id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2"
              >
                <span className="flex-1 font-medium">
                  {prof?.full_name ?? p.user_id}
                </span>
                {p.rank ? (
                  <Badge>#{p.rank}</Badge>
                ) : (
                  <Badge variant="outline">{p.status}</Badge>
                )}
                {p.score != null ? (
                  <Badge variant="outline">skor {p.score}</Badge>
                ) : null}
                {p.points_awarded ? (
                  <Badge variant="secondary">+{p.points_awarded} poin</Badge>
                ) : null}
                {manageable ? (
                  <form action={recordResult} className="flex gap-1">
                    <input type="hidden" name="competition_id" value={id} />
                    <input type="hidden" name="user_id" value={p.user_id} />
                    <Input
                      name="rank"
                      type="number"
                      min={1}
                      placeholder="Rank"
                      required
                      className="w-20"
                    />
                    <Input
                      name="score"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Skor"
                      required
                      className="w-24"
                    />
                    <Input
                      name="points"
                      type="number"
                      min={0}
                      placeholder="Poin"
                      required
                      className="w-24"
                    />
                    <Button type="submit" size="sm">
                      Simpan
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {manageable ? (
            <form action={addParticipant} className="flex gap-2 border-t pt-3">
              <input type="hidden" name="competition_id" value={id} />
              <Input name="user_id" placeholder="User ID (UUID)" required />
              <Button type="submit" size="sm" variant="outline">
                + Peserta
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {canDelete ? (
        <form action={deleteCompetition}>
          <input type="hidden" name="competition_id" value={id} />
          <Button type="submit" size="sm" variant="destructive">
            Hapus kompetisi
          </Button>
        </form>
      ) : null}
    </main>
  );
}

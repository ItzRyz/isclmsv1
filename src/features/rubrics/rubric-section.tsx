import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import {
  addRubricItem,
  createRubric,
  deleteRubric,
  deleteRubricItem,
} from "./actions";

/** Kelola rubrik + kriteria per assignment (staf). */
export async function RubricSection({
  assignmentId,
  manageable,
}: {
  assignmentId: string;
  manageable: boolean;
}) {
  const supabase = await createClient();
  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("id, name, max_score")
    .eq("assignment_id", assignmentId)
    .order("created_at");
  const rubricIds = ((rubrics ?? []) as { id: string }[]).map((r) => r.id);
  const { data: items } = rubricIds.length
    ? await supabase
        .from("rubric_items")
        .select("id, rubric_id, criterion, max_points, position")
        .in("rubric_id", rubricIds)
        .order("position")
    : { data: [] as unknown[] };
  const byRubric = new Map<
    string,
    { id: string; criterion: string; max_points: number }[]
  >();
  for (const it of (items ?? []) as {
    id: string;
    rubric_id: string;
    criterion: string;
    max_points: number;
  }[]) {
    byRubric.set(it.rubric_id, [...(byRubric.get(it.rubric_id) ?? []), it]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rubrik ({((rubrics ?? []) as unknown[]).length})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {(
          (rubrics ?? []) as { id: string; name: string; max_score: number }[]
        ).map((r) => (
          <div key={r.id} className="flex flex-col gap-1 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-medium">{r.name}</span>
              <Badge variant="outline">maks {r.max_score}</Badge>
              {manageable ? (
                <form action={deleteRubric}>
                  <input
                    type="hidden"
                    name="assignment_id"
                    value={assignmentId}
                  />
                  <input type="hidden" name="rubric_id" value={r.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
            {(byRubric.get(r.id) ?? []).map((it) => (
              <div key={it.id} className="ml-4 flex items-center gap-2">
                <span className="flex-1">
                  {it.criterion}{" "}
                  <Badge variant="outline">{it.max_points}</Badge>
                </span>
                {manageable ? (
                  <form action={deleteRubricItem}>
                    <input
                      type="hidden"
                      name="assignment_id"
                      value={assignmentId}
                    />
                    <input type="hidden" name="item_id" value={it.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      aria-label={`Hapus kriteria ${it.criterion}`}
                    >
                      ✕
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
            {manageable ? (
              <form action={addRubricItem} className="ml-4 flex gap-2 pt-1">
                <input
                  type="hidden"
                  name="assignment_id"
                  value={assignmentId}
                />
                <input type="hidden" name="rubric_id" value={r.id} />
                <Input
                  name="criterion"
                  placeholder="Kriteria"
                  required
                  minLength={2}
                  maxLength={300}
                />
                <Input
                  name="max_points"
                  type="number"
                  min={0}
                  max={100000}
                  placeholder="Poin"
                  required
                />
                <Button type="submit" size="sm" variant="outline">
                  +
                </Button>
              </form>
            ) : null}
          </div>
        ))}
        {manageable ? (
          <form
            action={createRubric}
            className="flex flex-col gap-2 border-t pt-3"
          >
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <div className="flex gap-2">
              <Input
                name="name"
                placeholder="Nama rubrik"
                required
                minLength={2}
                maxLength={160}
              />
              <Input
                name="max_score"
                type="number"
                min={1}
                max={100000}
                placeholder="Skor maks"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Tambah rubrik
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

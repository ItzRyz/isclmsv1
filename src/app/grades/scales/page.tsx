import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { kkmOf } from "@/features/grades/calc";
import { deleteScale, upsertScale } from "@/features/grades/scale-actions";

export default async function ScalesPage() {
  const manageable = await can("grade.update").catch(() => false);
  const supabase = await createClient();
  const { data: scales } = await supabase
    .from("grade_scales")
    .select("id, code, letter, min_score, max_score, is_passing, remark")
    .order("min_score", { ascending: false });
  const list = (scales ?? []) as {
    id: string;
    code: string;
    letter: string;
    min_score: number;
    max_score: number;
    is_passing: boolean;
    remark: string | null;
  }[];
  const kkm = kkmOf(list);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Skala nilai {kkm !== null ? <Badge>KKM {kkm}</Badge> : null}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Pita nilai</CardTitle>
          <CardDescription>
            KKM = batas bawah pita lulus terendah.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1">
              <Badge className="w-12 justify-center">{s.letter}</Badge>
              <span className="flex-1">
                {s.min_score}–{s.max_score} {s.remark ? `· ${s.remark}` : ""}
              </span>
              {s.is_passing ? (
                <Badge variant="secondary">Lulus</Badge>
              ) : (
                <Badge variant="destructive">Tidak</Badge>
              )}
              {manageable ? (
                <form action={deleteScale}>
                  <input type="hidden" name="scale_id" value={s.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
          {list.length === 0 ? (
            <span className="text-muted-foreground">Belum ada skala.</span>
          ) : null}
        </CardContent>
      </Card>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Tambah / perbarui pita (per kode)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={upsertScale} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <Input
                  name="code"
                  placeholder="KODE mis. A"
                  required
                  minLength={1}
                  maxLength={32}
                />
                <Input
                  name="letter"
                  placeholder="Huruf mis. A"
                  required
                  minLength={1}
                  maxLength={8}
                />
              </div>
              <div className="flex gap-3">
                <Input
                  name="min_score"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  placeholder="Min"
                  required
                />
                <Input
                  name="max_score"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  placeholder="Maks"
                  required
                />
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_passing" defaultChecked />
                  Pita lulus
                </label>
                <Input name="remark" placeholder="Keterangan" maxLength={500} />
              </div>
              <Button type="submit">Simpan</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  createBatch,
  createPeriod,
  deleteBatch,
  deletePeriod,
  setActivePeriod,
} from "@/features/academic/actions";

type Period = {
  id: string;
  name: string;
  code: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
};

type Batch = Period;

function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${start ?? "?"} → ${end ?? "?"}`;
}

export default async function AcademicPage() {
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("academic_periods")
    .select("id, name, code, start_date, end_date, status")
    .order("start_date", { nullsFirst: false });
  const { data: batches } = await supabase
    .from("batches")
    .select("id, name, code, start_date, end_date, status")
    .order("start_date", { nullsFirst: false });
  const manageable = await can("class.create").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Tahun Ajaran & Batch</h1>

      <Card>
        <CardHeader>
          <CardTitle>Periode akademik</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {((periods ?? []) as Period[]).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.name}</span>
              <Badge variant="outline">{p.code}</Badge>
              <Badge>{p.status}</Badge>
              <span className="text-muted-foreground">
                {dateRange(p.start_date, p.end_date)}
              </span>
              {manageable && p.status !== "ACTIVE" ? (
                <form action={setActivePeriod}>
                  <input type="hidden" name="period_id" value={p.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Jadikan aktif
                  </Button>
                </form>
              ) : null}
              {manageable ? (
                <form action={deletePeriod}>
                  <input type="hidden" name="period_id" value={p.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
          {(periods ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada periode.</span>
          ) : null}
          {manageable ? (
            <form
              action={createPeriod}
              className="mt-2 flex flex-col gap-3 border-t pt-4"
            >
              <div className="flex gap-3">
                <Input
                  name="name"
                  placeholder="Nama periode"
                  required
                  minLength={3}
                  maxLength={120}
                />
                <Input
                  name="code"
                  placeholder="KODE"
                  required
                  minLength={2}
                  maxLength={32}
                />
              </div>
              <div className="flex gap-3">
                <Input name="start_date" type="date" />
                <Input name="end_date" type="date" />
              </div>
              <Button type="submit">Tambah periode</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Batch</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {((batches ?? []) as Batch[]).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{b.name}</span>
              <Badge variant="outline">{b.code}</Badge>
              <Badge>{b.status}</Badge>
              <span className="text-muted-foreground">
                {dateRange(b.start_date, b.end_date)}
              </span>
              {manageable ? (
                <form action={deleteBatch}>
                  <input type="hidden" name="batch_id" value={b.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
          {(batches ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada batch.</span>
          ) : null}
          {manageable ? (
            <form
              action={createBatch}
              className="mt-2 flex flex-col gap-3 border-t pt-4"
            >
              <div className="flex gap-3">
                <Input
                  name="name"
                  placeholder="Nama batch"
                  required
                  minLength={3}
                  maxLength={120}
                />
                <Input
                  name="code"
                  placeholder="KODE"
                  required
                  minLength={2}
                  maxLength={32}
                />
              </div>
              <div className="flex gap-3">
                <Input name="start_date" type="date" />
                <Input name="end_date" type="date" />
              </div>
              <Button type="submit">Tambah batch</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { generateReportCard } from "@/features/reports/actions";
import { DownloadReportPdf } from "@/features/reports/download-pdf";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string => {
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const userId = get("user");
  const periodId = get("period");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const manageable = await can("grade.publish").catch(() => false);
  const { data: periods } = await supabase
    .from("academic_periods")
    .select("id, name")
    .order("name");

  const targetUser = manageable ? userId || user?.id || "" : (user?.id ?? "");
  const { data: report } =
    targetUser && periodId
      ? await supabase
          .from("report_cards")
          .select(
            "id, total_score, grade_letter, generated_at, report_card_items(score, weight, weighted_score, grade_components(code))",
          )
          .eq("user_id", targetUser)
          .eq("academic_period_id", periodId)
          .single()
      : { data: null };
  const { data: prof } = targetUser
    ? await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", targetUser)
        .single()
    : { data: null };
  const { data: period } = periodId
    ? await supabase
        .from("academic_periods")
        .select("name")
        .eq("id", periodId)
        .single()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Rapor</h1>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            {manageable ? (
              <Input name="user" placeholder="User ID" defaultValue={userId} />
            ) : null}
            <select
              name="period"
              defaultValue={periodId}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Pilih periode…</option>
              {((periods ?? []) as { id: string; name: string }[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {(prof as { full_name: string | null } | null)?.full_name ?? "—"}
              <Badge>
                {(report as { total_score: number }).total_score} (
                {(report as { grade_letter: string }).grade_letter})
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {(
              (
                report as unknown as {
                  report_card_items: {
                    score: number;
                    weight: number;
                    weighted_score: number;
                    grade_components:
                      { code: string } | { code: string }[] | null;
                  }[];
                }
              ).report_card_items ?? []
            ).map((it, i) => {
              const comp = Array.isArray(it.grade_components)
                ? it.grade_components[0]
                : it.grade_components;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 border-b py-1 last:border-0"
                >
                  <span className="flex-1">{comp?.code ?? "—"}</span>
                  <span>
                    {it.score} × {it.weight} = {it.weighted_score}
                  </span>
                </div>
              );
            })}
            <div className="pt-2">
              <DownloadReportPdf
                report={{
                  student:
                    (prof as { full_name: string | null } | null)?.full_name ??
                    targetUser,
                  period: (period as { name: string } | null)?.name ?? periodId,
                  total: (report as { total_score: number }).total_score,
                  letter: (report as { grade_letter: string }).grade_letter,
                  items: (
                    (
                      report as unknown as {
                        report_card_items: {
                          score: number;
                          weight: number;
                          weighted_score: number;
                          grade_components:
                            { code: string } | { code: string }[] | null;
                        }[];
                      }
                    ).report_card_items ?? []
                  ).map((it) => ({
                    component:
                      (Array.isArray(it.grade_components)
                        ? it.grade_components[0]
                        : it.grade_components
                      )?.code ?? "—",
                    score: it.score,
                    weight: it.weight,
                    weighted: it.weighted_score,
                  })),
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : targetUser && periodId ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            Belum ada rapor periode ini.
          </CardContent>
        </Card>
      ) : null}

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate rapor</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={generateReportCard} className="flex gap-2">
              <Input name="user_id" placeholder="User ID (UUID)" required />
              <select
                name="academic_period_id"
                required
                defaultValue=""
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Periode
                </option>
                {((periods ?? []) as { id: string; name: string }[]).map(
                  (p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ),
                )}
              </select>
              <Button type="submit" size="sm">
                Generate
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAccess } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  eventsInMonth,
  isDay,
  visibleEvents,
  type CalendarEvent,
} from "@/features/calendar/events";

function monthParam(sp: Record<string, string | string[] | undefined>): {
  y: number;
  m: number;
} {
  const now = new Date();
  const y = Number(Array.isArray(sp.y) ? sp.y[0] : sp.y);
  const m = Number(Array.isArray(sp.m) ? sp.m[0] : sp.m);
  return {
    y: Number.isInteger(y) && y > 2000 && y < 2100 ? y : now.getFullYear(),
    m: Number.isInteger(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1,
  };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { y, m } = monthParam(sp);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Kalender akademik</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Masuk dulu untuk melihat kalender.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { memberships } = await loadAccess(user.id);
  const { data: broad } = await supabase.rpc("has_permission", {
    p_user_id: user.id,
    p_permission_code: "member.manage",
  });

  const { data: periods } = await supabase
    .from("academic_periods")
    .select("id, name, start_date, end_date");
  const { data: batches } = await supabase
    .from("batches")
    .select("id, name, start_date, end_date");
  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, name, division_id, batches(start_date, end_date), academic_periods(start_date, end_date)",
    );

  const all: CalendarEvent[] = [];
  for (const p of (periods ?? []) as {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
  }[]) {
    if (isDay(p.start_date)) {
      all.push({
        id: `period:${p.id}`,
        title: p.name,
        source: "period",
        start: p.start_date,
        end: isDay(p.end_date) ? p.end_date : null,
        divisionId: null,
        classId: null,
      });
    }
  }
  for (const b of (batches ?? []) as {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
  }[]) {
    if (isDay(b.start_date)) {
      all.push({
        id: `batch:${b.id}`,
        title: `Batch ${b.name}`,
        source: "batch",
        start: b.start_date,
        end: isDay(b.end_date) ? b.end_date : null,
        divisionId: null,
        classId: null,
      });
    }
  }
  for (const c of (classes ?? []) as {
    id: string;
    name: string;
    division_id: string;
    batches:
      | { start_date: string | null; end_date: string | null }
      | { start_date: string | null; end_date: string | null }[]
      | null;
    academic_periods:
      | {
          start_date: string | null;
          end_date: string | null;
        }
      | {
          start_date: string | null;
          end_date: string | null;
        }[]
      | null;
  }[]) {
    const batch = Array.isArray(c.batches) ? c.batches[0] : c.batches;
    const period = Array.isArray(c.academic_periods)
      ? c.academic_periods[0]
      : c.academic_periods;
    const range = batch ?? period ?? null;
    if (range && isDay(range.start_date)) {
      all.push({
        id: `class:${c.id}`,
        title: c.name,
        source: "class",
        start: range.start_date,
        end: isDay(range.end_date) ? range.end_date : null,
        divisionId: c.division_id,
        classId: c.id,
      });
    }
  }

  const visible = visibleEvents(all, {
    userId: user.id,
    divisionIds: memberships.divisionIds,
    classIds: memberships.classIds,
    canViewAll: broad === true,
  });
  const monthly = eventsInMonth(visible, y, m);

  const monthStart = startOfMonth(new Date(y, m - 1, 1));
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });
  const prev = addMonths(monthStart, -1);
  const next = addMonths(monthStart, 1);
  const dayKey = (d: Date): string => format(d, "yyyy-MM-dd");

  const variant = (
    s: CalendarEvent["source"],
  ): "default" | "secondary" | "outline" =>
    s === "period" ? "default" : s === "batch" ? "secondary" : "outline";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {format(monthStart, "MMMM yyyy")}
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/calendar?y=${prev.getFullYear()}&m=${prev.getMonth() + 1}`}
          >
            <Button variant="outline" size="sm" aria-label="Bulan sebelumnya">
              ←
            </Button>
          </Link>
          <Link
            href={`/calendar?y=${next.getFullYear()}&m=${next.getMonth() + 1}`}
          >
            <Button variant="outline" size="sm" aria-label="Bulan berikutnya">
              →
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <div className="text-muted-foreground grid min-w-[560px] grid-cols-7 gap-1 text-center text-xs">
            {["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mn"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const key = dayKey(d);
              const inMonth = d.getMonth() === m - 1;
              const hits = monthly.filter(
                (e) => e.start <= key && (e.end ?? e.start) >= key,
              );
              return (
                <div
                  key={key}
                  className={`min-h-14 rounded-md border p-1 text-left ${inMonth ? "" : "opacity-40"}`}
                >
                  <div className="text-xs font-medium">{d.getDate()}</div>
                  {hits.slice(0, 2).map((e) => (
                    <Badge
                      key={e.id}
                      variant={variant(e.source)}
                      className="mb-0.5 block truncate text-[10px]"
                    >
                      {e.title}
                    </Badge>
                  ))}
                  {hits.length > 2 ? (
                    <div className="text-muted-foreground text-[10px]">
                      +{hits.length - 2}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agenda bulan ini ({monthly.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {monthly.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <Badge variant={variant(e.source)}>{e.source}</Badge>
              <span className="font-medium">{e.title}</span>
              <span className="text-muted-foreground">
                {e.start}
                {e.end && e.end !== e.start ? ` → ${e.end}` : ""}
              </span>
            </div>
          ))}
          {monthly.length === 0 ? (
            <span className="text-muted-foreground">Tidak ada agenda.</span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

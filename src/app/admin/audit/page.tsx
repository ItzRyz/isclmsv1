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

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const allowed = await can("audit.view").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission audit.view.
          </CardContent>
        </Card>
      </main>
    );
  }

  const sp = await searchParams;
  const get = (k: string): string => {
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const actor = get("actor");
  const entity = get("entity");
  const action = get("action");
  const from = get("from");
  const to = get("to");

  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id, actor_id, action, entity_type, entity_id, old_values, new_values, created_at, profiles(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (actor) query = query.eq("actor_id", actor);
  if (entity) query = query.eq("entity_type", entity);
  if (action) query = query.ilike("action", `%${action}%`);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  const { data: rows } = await query;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Audit log (read-only)</h1>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap gap-2">
            <Input
              name="actor"
              placeholder="Actor ID (UUID)"
              defaultValue={actor}
            />
            <Input
              name="entity"
              placeholder="Entity mis. grades"
              defaultValue={entity}
            />
            <Input
              name="action"
              placeholder="Aksi mis. grade"
              defaultValue={action}
            />
            <Input name="from" type="date" defaultValue={from} />
            <Input name="to" type="date" defaultValue={to} />
            <Button type="submit" size="sm">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Hasil ({((rows ?? []) as unknown[]).length})
            <Badge variant="outline">Immutable — tanpa ubah/hapus</Badge>
          </CardTitle>
          <CardDescription>
            Jejak grade, absensi, peran, finansial, sertifikat.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {(
            (rows ?? []) as unknown as {
              id: string;
              actor_id: string | null;
              action: string;
              entity_type: string;
              entity_id: string | null;
              old_values: unknown;
              new_values: unknown;
              created_at: string;
              profiles: { full_name: string | null } | null;
            }[]
          ).map((r) => {
            const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return (
              <details key={r.id} className="rounded-md border p-2">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <Badge>{r.action}</Badge>
                  <span className="text-muted-foreground">{r.entity_type}</span>
                  <span className="text-muted-foreground ml-auto">
                    {prof?.full_name ?? r.actor_id?.slice(0, 8) ?? "sistem"} ·{" "}
                    {new Date(r.created_at).toLocaleString("id-ID")}
                  </span>
                </summary>
                <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 text-xs">
                  {JSON.stringify(
                    {
                      old: r.old_values,
                      new: r.new_values,
                      entity: r.entity_id,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            );
          })}
          {(rows ?? []).length === 0 ? (
            <span className="text-muted-foreground">Tidak ada hasil.</span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

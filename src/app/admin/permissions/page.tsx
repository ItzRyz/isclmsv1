import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { togglePermission } from "@/features/admin-permissions/actions";

const SCOPES = [
  "GLOBAL",
  "ORGANIZATION",
  "DIVISION",
  "CLASS",
  "COURSE",
  "OWN",
] as const;

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const allowed = await can("permission.view").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission.view.
          </CardContent>
        </Card>
      </main>
    );
  }

  const sp = await searchParams;
  const rawRole = sp["role"];
  const roleFilter = (
    Array.isArray(rawRole) ? (rawRole[0] ?? "") : (rawRole ?? "")
  ).toUpperCase();
  const editable = await can("permission.manage").catch(() => false);

  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("id, code, name, is_system")
    .order("code");
  const { data: perms } = await supabase
    .from("permissions")
    .select("id, code, resource")
    .order("code");
  const { data: mappings } = await supabase
    .from("role_permissions")
    .select("role_id, permission_id, scope");

  const granted = new Set(
    (
      (mappings ?? []) as {
        role_id: string;
        permission_id: string;
        scope: string;
      }[]
    ).map((m) => `${m.role_id}:${m.permission_id}:${m.scope}`),
  );
  const shownRoles = (
    (roles ?? []) as {
      id: string;
      code: string;
      name: string;
      is_system: boolean;
    }[]
  ).filter((r) => !roleFilter || r.code === roleFilter);
  const byResource = new Map<string, { id: string; code: string }[]>();
  for (const p of (perms ?? []) as {
    id: string;
    code: string;
    resource: string;
  }[]) {
    byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p]);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Matriks permission</h1>
        <form method="GET" className="flex gap-2">
          <select
            name="role"
            defaultValue={roleFilter}
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Semua peran</option>
            {((roles ?? []) as { code: string }[]).map((r) => (
              <option key={r.code} value={r.code}>
                {r.code}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Filter
          </Button>
        </form>
      </div>

      {!editable ? (
        <p className="text-muted-foreground text-sm">
          Mode lihat saja (butuh permission.manage untuk mengubah). Peran sistem
          bertanda <Badge>SYSTEM</Badge>.
        </p>
      ) : null}

      {shownRoles.map((role) => (
        <Card key={role.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {role.code}
              {role.is_system ? (
                <Badge variant="secondary">SYSTEM</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {[...byResource.entries()].map(([resource, list]) => (
              <div key={resource}>
                <div className="text-muted-foreground font-medium">
                  {resource}
                </div>
                <div className="flex flex-wrap gap-1">
                  {list.map((p) => {
                    const scopes = SCOPES.filter((s) =>
                      granted.has(`${role.id}:${p.id}:${s}`),
                    );
                    return (
                      <span
                        key={p.id}
                        title={scopes.join(", ") || "tidak ada"}
                        className={`rounded-md border px-2 py-1 text-xs ${scopes.length ? "border-primary bg-primary/10" : "opacity-60"}`}
                      >
                        {p.code}
                        {scopes.length ? ` [${scopes.join("/")}]` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
            {editable ? (
              <form
                action={togglePermission}
                className="flex flex-wrap gap-2 border-t pt-3"
              >
                <input type="hidden" name="role_code" value={role.code} />
                <select
                  name="permission_code"
                  required
                  defaultValue=""
                  className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                >
                  <option value="" disabled>
                    Permission
                  </option>
                  {((perms ?? []) as { code: string }[]).map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
                <select
                  name="scope"
                  defaultValue="ORGANIZATION"
                  className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                >
                  {SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  name="grant"
                  defaultValue="on"
                  className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                >
                  <option value="on">Beri</option>
                  <option value="off">Cabut</option>
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Terapkan
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </main>
  );
}

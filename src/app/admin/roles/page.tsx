import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { assignRole, revokeRole } from "./actions";

export default async function AdminRolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Peran</CardTitle>
            <CardDescription>Masuk dulu untuk mengelola peran.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { data: allowed } = await supabase.rpc("has_permission", {
    p_user_id: user.id,
    p_permission_code: "user.assign_role",
  });
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
            <CardDescription>
              Butuh permission user.assign_role.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { data: roles } = await supabase
    .from("roles")
    .select("id, code, name")
    .order("code");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>Assign Role</CardTitle>
          <CardDescription>
            Tercatat di audit_logs (role.assign) beserta actor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={assignRole} className="flex flex-col gap-3">
            <Input name="user_id" placeholder="User ID (UUID)" required />
            <select
              name="role_id"
              required
              defaultValue=""
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Pilih peran
              </option>
              {(roles ?? []).map((r: { id: string; code: string }) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>
            <Button type="submit">Assign</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revoke Role</CardTitle>
          <CardDescription>
            Tercatat di audit_logs (role.revoke). Tanpa UPDATE langsung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={revokeRole} className="flex flex-col gap-3">
            <Input name="user_id" placeholder="User ID (UUID)" required />
            <select
              name="role_id"
              required
              defaultValue=""
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Pilih peran
              </option>
              {(roles ?? []).map((r: { id: string; code: string }) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>
            <Button type="submit" variant="destructive">
              Revoke
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

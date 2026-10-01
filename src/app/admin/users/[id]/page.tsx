import { notFound } from "next/navigation";
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
import {
  assignUserRole,
  revokeUserRole,
  setUserStatus,
  updateUserProfile,
} from "@/features/admin-users/actions";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const allowed = await can("user.view").catch(() => false);
  if (!allowed) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, email, phone, student_number, status")
    .eq("id", id)
    .single();
  if (!profile) notFound();

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role_id, roles(code, name)")
    .eq("user_id", id);
  const { data: allRoles } = await supabase
    .from("roles")
    .select("id, code, name")
    .order("code");
  const owned = new Set(
    ((userRoles ?? []) as { role_id: string }[]).map((r) => r.role_id),
  );

  const canEdit = await can("user.update").catch(() => false);
  const canAssign = await can("user.assign_role").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {(profile as { full_name: string | null }).full_name ??
              "Tanpa nama"}
            <Badge>{(profile as { status: string }).status}</Badge>
          </CardTitle>
          <CardDescription>
            {(profile as { email: string | null }).email ?? id}
          </CardDescription>
        </CardHeader>
      </Card>

      {canEdit ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ubah profil</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateUserProfile} className="flex flex-col gap-3">
                <input type="hidden" name="user_id" value={id} />
                <Input
                  name="full_name"
                  defaultValue={
                    (profile as { full_name: string | null }).full_name ?? ""
                  }
                  placeholder="Nama lengkap"
                  maxLength={160}
                />
                <div className="flex gap-3">
                  <Input
                    name="username"
                    defaultValue={
                      (profile as { username: string | null }).username ?? ""
                    }
                    placeholder="username"
                    maxLength={40}
                  />
                  <Input
                    name="student_number"
                    defaultValue={
                      (profile as { student_number: string | null })
                        .student_number ?? ""
                    }
                    placeholder="NIM"
                    maxLength={64}
                  />
                </div>
                <Input
                  name="phone"
                  defaultValue={
                    (profile as { phone: string | null }).phone ?? ""
                  }
                  placeholder="Telepon"
                  maxLength={32}
                />
                <Button type="submit">Simpan</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status akun</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={setUserStatus} className="flex gap-2">
                <input type="hidden" name="user_id" value={id} />
                <select
                  name="status"
                  defaultValue={(profile as { status: string }).status}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
                <Button type="submit" size="sm">
                  Set
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Peran</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {(
            (userRoles ?? []) as unknown as {
              role_id: string;
              roles: { code: string } | { code: string }[] | null;
            }[]
          ).map((r) => {
            const role = Array.isArray(r.roles) ? r.roles[0] : r.roles;
            return (
              <div key={r.role_id} className="flex items-center gap-2">
                <Badge className="flex-1 justify-start">{role?.code}</Badge>
                {canAssign ? (
                  <form action={revokeUserRole}>
                    <input type="hidden" name="user_id" value={id} />
                    <input type="hidden" name="role_id" value={r.role_id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Cabut
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {canAssign ? (
            <form action={assignUserRole} className="flex gap-2 border-t pt-3">
              <input type="hidden" name="user_id" value={id} />
              <select
                name="role_id"
                required
                defaultValue=""
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pilih peran
                </option>
                {((allRoles ?? []) as { id: string; code: string }[])
                  .filter((r) => !owned.has(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
              </select>
              <Button type="submit" size="sm">
                Beri
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

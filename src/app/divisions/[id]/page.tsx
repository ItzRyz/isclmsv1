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
  addDivisionMember,
  assignCoordinator,
  deleteDivision,
  updateDivision,
} from "@/features/divisions/actions";

export default async function DivisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: division } = await supabase
    .from("divisions")
    .select("id, name, code, slug, description, status")
    .eq("id", id)
    .single();
  if (!division) notFound();

  const { data: members } = await supabase
    .from("user_divisions")
    .select("user_id, membership_type, profiles(full_name, username)")
    .eq("division_id", id)
    .is("ended_at", null);

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, code, status")
    .eq("division_id", id)
    .order("name");

  const { data: roles } = await supabase
    .from("roles")
    .select("id, code")
    .in("code", ["WEB_COORDINATOR", "ML_COORDINATOR", "UIUX_COORDINATOR"])
    .order("code");

  const canEdit = await can("division.update").catch(() => false);
  const canManage = await can("member.manage").catch(() => false);
  const canDelete = await can("division.delete").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {division.name} <Badge variant="secondary">{division.code}</Badge>
            <Badge>{division.status}</Badge>
          </CardTitle>
          <CardDescription>
            {division.description ?? division.slug}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Kelas ({(classes ?? []).length}) — Anggota ({(members ?? []).length}
            )
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {(classes ?? []).map(
            (c: { id: string; name: string; code: string; status: string }) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge variant="outline">{c.code}</Badge>
                <Badge>{c.status}</Badge>
              </div>
            ),
          )}
          {(classes ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada kelas.</span>
          ) : null}
          <div className="mt-2 border-t pt-2">
            {(members ?? []).map(
              (m: {
                user_id: string;
                membership_type: string;
                profiles:
                  | {
                      full_name: string | null;
                      username: string | null;
                    }
                  | {
                      full_name: string | null;
                      username: string | null;
                    }[]
                  | null;
              }) => {
                const prof = Array.isArray(m.profiles)
                  ? m.profiles[0]
                  : m.profiles;
                return (
                  <div key={m.user_id} className="flex items-center gap-2 py-1">
                    <span>{prof?.full_name ?? m.user_id}</span>
                    <Badge variant="secondary">{m.membership_type}</Badge>
                  </div>
                );
              },
            )}
            {(members ?? []).length === 0 ? (
              <span className="text-muted-foreground">Belum ada anggota.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Ubah divisi</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateDivision} className="flex flex-col gap-3">
              <input type="hidden" name="division_id" value={division.id} />
              <Input
                name="name"
                defaultValue={division.name}
                required
                minLength={3}
                maxLength={120}
              />
              <div className="flex gap-3">
                <Input
                  name="code"
                  defaultValue={division.code}
                  required
                  minLength={2}
                  maxLength={16}
                />
                <Input
                  name="slug"
                  defaultValue={division.slug}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>
              <Input
                name="description"
                defaultValue={division.description ?? ""}
                maxLength={2000}
              />
              <select
                name="status"
                defaultValue={division.status}
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              <Button type="submit">Simpan</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tambah anggota</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addDivisionMember} className="flex flex-col gap-3">
                <input type="hidden" name="division_id" value={division.id} />
                <Input name="user_id" placeholder="User ID (UUID)" required />
                <select
                  name="membership_type"
                  defaultValue="MEMBER"
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="MENTOR">MENTOR</option>
                  <option value="COORDINATOR">COORDINATOR</option>
                </select>
                <Button type="submit">Tambah</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign koordinator</CardTitle>
              <CardDescription>
                Peran + keanggotaan sekaligus; peran harus sesuai divisinya.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={assignCoordinator} className="flex flex-col gap-3">
                <input type="hidden" name="division_id" value={division.id} />
                <Input name="user_id" placeholder="User ID (UUID)" required />
                <select
                  name="role_id"
                  required
                  defaultValue=""
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Pilih peran koordinator
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
        </>
      ) : null}

      {canDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Zona berbahaya</CardTitle>
            <CardDescription>
              Menghapus divisi ikut menghapus kelas di dalamnya (cascade).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deleteDivision}>
              <input type="hidden" name="division_id" value={division.id} />
              <Button type="submit" variant="destructive">
                Hapus divisi
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

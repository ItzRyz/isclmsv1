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
  addClassMember,
  deleteClass,
  removeClassMember,
  updateClass,
} from "@/features/classes/actions";

type MemberRow = {
  user_id: string;
  status: string;
  profiles:
    | { full_name: string | null; username: string | null }
    | { full_name: string | null; username: string | null }[]
    | null;
};

export default async function ClassDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("classes")
    .select(
      "id, name, code, capacity, status, divisions(name, code), batches(name), academic_periods(name)",
    )
    .eq("id", id)
    .single();
  if (!cls) notFound();
  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;
  const division = one(
    cls.divisions as { name: string } | { name: string }[] | null,
  );
  const batch = one(
    cls.batches as { name: string } | { name: string }[] | null,
  );
  const period = one(
    cls.academic_periods as { name: string } | { name: string }[] | null,
  );

  const { data: members } = await supabase
    .from("class_members")
    .select("user_id, status, profiles(full_name, username)")
    .eq("class_id", id)
    .is("left_at", null)
    .order("joined_at");
  const activeCount = (members ?? []).length;
  const full = typeof cls.capacity === "number" && activeCount >= cls.capacity;

  const canEdit = await can("class.update").catch(() => false);
  const canManage = await can("member.manage").catch(() => false);
  const canDelete = await can("class.delete").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {cls.name} <Badge variant="outline">{cls.code}</Badge>
            <Badge>{cls.status}</Badge>
          </CardTitle>
          <CardDescription>
            {division?.name ?? "—"} · Batch {batch?.name ?? "—"} · Periode{" "}
            {period?.name ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 text-sm">
          <Badge variant="secondary">
            {activeCount}
            {typeof cls.capacity === "number" ? `/${cls.capacity}` : ""} anggota
          </Badge>
          {full ? <Badge variant="destructive">Penuh</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anggota ({activeCount})</CardTitle>
          <CardDescription>
            Mentor = anggota ber-peran MENTOR (atur peran via /admin/roles).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {((members ?? []) as MemberRow[]).map((m) => {
            const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return (
              <div key={m.user_id} className="flex items-center gap-2 py-1">
                <span className="flex-1">{prof?.full_name ?? m.user_id}</span>
                <Badge variant="outline">{m.status}</Badge>
                {canManage ? (
                  <form action={removeClassMember}>
                    <input type="hidden" name="class_id" value={id} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Keluarkan
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {(members ?? []).length === 0 ? (
            <span className="text-muted-foreground">
              Belum ada anggota aktif.
            </span>
          ) : null}
          {canManage && !full ? (
            <form
              action={addClassMember}
              className="mt-2 flex gap-3 border-t pt-4"
            >
              <input type="hidden" name="class_id" value={id} />
              <Input name="user_id" placeholder="User ID (UUID)" required />
              <Button type="submit">Tambah</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Ubah kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateClass} className="flex flex-col gap-3">
              <input type="hidden" name="class_id" value={id} />
              <Input
                name="name"
                defaultValue={cls.name}
                required
                minLength={3}
                maxLength={120}
              />
              <div className="flex gap-3">
                <Input
                  name="capacity"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={cls.capacity ?? ""}
                  placeholder="Kapasitas"
                />
                <select
                  name="status"
                  defaultValue={cls.status}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <Button type="submit">Simpan</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Zona berbahaya</CardTitle>
            <CardDescription>
              Menghapus kelas ikut menghapus keanggotaan (cascade).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deleteClass}>
              <input type="hidden" name="class_id" value={id} />
              <Button type="submit" variant="destructive">
                Hapus kelas
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

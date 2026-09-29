import Link from "next/link";
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
  archiveCourse,
  deleteCourse,
  publishCourse,
  updateCourse,
} from "@/features/courses/actions";
import {
  createModule,
  deleteModule,
  moveModule,
} from "@/features/modules/actions";
import { createMaterial } from "@/features/materials/actions";
import { createAssignment } from "@/features/assignments/actions";
import { isVisibleNow } from "@/features/materials/visibility";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, name, code, description, difficulty, estimated_hours, status, divisions(name, code)",
    )
    .eq("id", id)
    .single();
  if (!course) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, position, status")
    .eq("course_id", id)
    .order("position");

  const moduleIds = ((modules ?? []) as { id: string }[]).map((m) => m.id);
  const { data: allMaterials } =
    moduleIds.length > 0
      ? await supabase
          .from("materials")
          .select(
            "id, module_id, title, type, status, is_required, scheduled_at",
          )
          .in("module_id", moduleIds)
          .order("created_at")
      : { data: [] as unknown[] };
  const staffMaterials = await can("material.update").catch(() => false);
  type MaterialRow = {
    id: string;
    module_id: string;
    title: string;
    type: string;
    status: string;
    is_required: boolean;
    scheduled_at: string | null;
  };
  const byModule = new Map<string, MaterialRow[]>();
  for (const mat of (allMaterials ?? []) as MaterialRow[]) {
    if (!staffMaterials && !isVisibleNow(mat)) continue;
    const list = byModule.get(mat.module_id) ?? [];
    list.push(mat);
    byModule.set(mat.module_id, list);
  }

  // Progress ringkas: materi required vs selesai milik user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let progress: { total: number; done: number } | null = null;
  if (user && modules && modules.length > 0) {
    const moduleIds = modules.map((m: { id: string }) => m.id);
    const { data: mats } = await supabase
      .from("materials")
      .select("id")
      .in("module_id", moduleIds)
      .eq("is_required", true);
    const matIds = ((mats ?? []) as { id: string }[]).map((m) => m.id);
    if (matIds.length > 0) {
      const { data: done } = await supabase
        .from("material_progress")
        .select("material_id")
        .eq("user_id", user.id)
        .in("material_id", matIds)
        .not("completed_at", "is", null);
      progress = { total: matIds.length, done: (done ?? []).length };
    } else {
      progress = { total: 0, done: 0 };
    }
  }

  const canEdit = await can("course.update").catch(() => false);
  const canDelete = await can("course.delete").catch(() => false);
  const canManageModules = await can("module.update").catch(() => false);
  const canAssign = await can("assignment.create").catch(() => false);
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, type, status, due_at")
    .eq("course_id", id)
    .order("due_at");
  const division = Array.isArray(course.divisions)
    ? course.divisions[0]
    : course.divisions;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {course.name}
            {course.code ? (
              <Badge variant="outline">{course.code}</Badge>
            ) : null}
            <Badge>{course.status}</Badge>
            {division ? (
              <Badge variant="secondary">{division.code}</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {course.description ?? "Tanpa deskripsi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {course.difficulty ? (
            <Badge variant="outline">{course.difficulty}</Badge>
          ) : null}
          {typeof course.estimated_hours === "number" ? (
            <Badge variant="outline">~{course.estimated_hours} jam</Badge>
          ) : null}
          {progress && progress.total > 0 ? (
            <div className="flex w-full flex-col gap-1">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>
                  Progres: {progress.done}/{progress.total} materi wajib
                </span>
                <span>
                  {Math.round((progress.done / progress.total) * 100)}%
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full"
                  style={{
                    width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          {canEdit && course.status === "DRAFT" ? (
            <form action={publishCourse}>
              <input type="hidden" name="course_id" value={course.id} />
              <Button type="submit" size="sm">
                Publish
              </Button>
            </form>
          ) : null}
          {canEdit && course.status === "PUBLISHED" ? (
            <form action={archiveCourse}>
              <input type="hidden" name="course_id" value={course.id} />
              <Button type="submit" size="sm" variant="outline">
                Arsipkan
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modul ({(modules ?? []).length})</CardTitle>
          {canManageModules ? null : (
            <CardDescription>
              Hanya staf pengelola yang bisa mengubah.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (modules ?? []) as {
              id: string;
              title: string;
              position: number;
              status: string;
            }[]
          ).map((m, i, arr) => (
            <div
              key={m.id}
              className="flex flex-col gap-1 border-b py-2 last:border-0"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline">{m.position}</Badge>
                <span className="flex-1 font-medium">{m.title}</span>
                <Badge>{m.status}</Badge>
                {canManageModules ? (
                  <>
                    <form action={moveModule}>
                      <input type="hidden" name="module_id" value={m.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        disabled={i === 0}
                      >
                        ↑
                      </Button>
                    </form>
                    <form action={moveModule}>
                      <input type="hidden" name="module_id" value={m.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        disabled={i === arr.length - 1}
                      >
                        ↓
                      </Button>
                    </form>
                    <form action={deleteModule}>
                      <input type="hidden" name="module_id" value={m.id} />
                      <input type="hidden" name="course_id" value={course.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Hapus
                      </Button>
                    </form>
                  </>
                ) : null}
              </div>
              <div className="ml-8 flex flex-col gap-1">
                {(byModule.get(m.id) ?? []).map(
                  (mat: {
                    id: string;
                    title: string;
                    type: string;
                    status: string;
                    is_required: boolean;
                  }) => (
                    <Link
                      key={mat.id}
                      href={`/materials/${mat.id}`}
                      className="flex items-center gap-2 py-0.5 hover:underline"
                    >
                      <Badge variant="outline">{mat.type}</Badge>
                      <span className="flex-1">{mat.title}</span>
                      {mat.is_required ? null : (
                        <Badge variant="secondary">Opsional</Badge>
                      )}
                      <Badge>{mat.status}</Badge>
                    </Link>
                  ),
                )}
                {staffMaterials ? (
                  <form
                    action={createMaterial}
                    className="flex flex-wrap gap-2 pt-1"
                  >
                    <input type="hidden" name="module_id" value={m.id} />
                    <input
                      name="title"
                      placeholder="Judul materi"
                      required
                      minLength={3}
                      maxLength={200}
                      className="border-input bg-background w-40 rounded-md border px-2 py-1 text-xs"
                    />
                    <input
                      name="slug"
                      placeholder="slug"
                      required
                      minLength={2}
                      maxLength={80}
                      className="border-input bg-background w-28 rounded-md border px-2 py-1 text-xs"
                    />
                    <select
                      name="type"
                      defaultValue="TEXT"
                      className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="LINK">LINK</option>
                      <option value="FILE">FILE</option>
                      <option value="VIDEO">VIDEO</option>
                    </select>
                    <input
                      name="url"
                      placeholder="URL (khusus LINK)"
                      className="border-input bg-background w-40 rounded-md border px-2 py-1 text-xs"
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        name="is_required"
                        defaultChecked
                      />
                      Wajib
                    </label>
                    <Button type="submit" size="sm" variant="outline">
                      + Materi
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
          {(modules ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada modul.</span>
          ) : null}
          {canManageModules ? (
            <form
              action={createModule}
              className="mt-2 flex flex-col gap-3 border-t pt-4"
            >
              <input type="hidden" name="course_id" value={course.id} />
              <div className="flex gap-3">
                <Input
                  name="title"
                  placeholder="Judul modul"
                  required
                  minLength={3}
                  maxLength={160}
                />
                <Input
                  name="slug"
                  placeholder="slug-modul"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>
              <Button type="submit">Tambah modul</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tugas ({(assignments ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (assignments ?? []) as {
              id: string;
              title: string;
              type: string;
              status: string;
              due_at: string;
            }[]
          ).map((a) => (
            <Link
              key={a.id}
              href={`/assignments/${a.id}`}
              className="flex items-center gap-2 py-1 hover:underline"
            >
              <span className="flex-1 font-medium">{a.title}</span>
              <Badge variant="outline">{a.type}</Badge>
              <Badge>{a.status}</Badge>
              <span className="text-muted-foreground">
                {new Date(a.due_at).toLocaleString("id-ID")}
              </span>
            </Link>
          ))}
          {(assignments ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada tugas.</span>
          ) : null}
          {canAssign ? (
            <form
              action={createAssignment}
              className="mt-2 flex flex-col gap-3 border-t pt-4"
            >
              <input type="hidden" name="course_id" value={course.id} />
              <div className="flex gap-3">
                <Input
                  name="title"
                  placeholder="Judul tugas"
                  required
                  minLength={3}
                  maxLength={200}
                />
                <Input
                  name="slug"
                  placeholder="slug-tugas"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>
              <div className="flex gap-3">
                <select
                  name="type"
                  defaultValue="INDIVIDUAL"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="INDIVIDUAL">INDIVIDUAL</option>
                  <option value="GROUP">GROUP</option>
                </select>
                <select
                  name="submission_type"
                  defaultValue="TEXT"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="TEXT">TEXT</option>
                  <option value="FILE">FILE</option>
                  <option value="TEXT_AND_FILE">TEXT_AND_FILE</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Input name="due_at" type="datetime-local" required />
                <Input
                  name="max_score"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={100}
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="revision_allowed" />
                Revisi diizinkan
              </label>
              <Button type="submit">Buat tugas (DRAFT)</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Ubah course</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateCourse} className="flex flex-col gap-3">
              <input type="hidden" name="course_id" value={course.id} />
              <Input
                name="name"
                defaultValue={course.name}
                required
                minLength={3}
                maxLength={160}
              />
              <div className="flex gap-3">
                <Input
                  name="code"
                  defaultValue={course.code ?? ""}
                  maxLength={32}
                />
                <Input
                  name="difficulty"
                  defaultValue={course.difficulty ?? ""}
                  maxLength={32}
                />
              </div>
              <Input
                name="description"
                defaultValue={course.description ?? ""}
                maxLength={4000}
              />
              <div className="flex gap-3">
                <Input
                  name="estimated_hours"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={course.estimated_hours ?? ""}
                />
                <select
                  name="status"
                  defaultValue={course.status}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
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
              Menghapus course ikut menghapus modul & materi (cascade).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deleteCourse}>
              <input type="hidden" name="course_id" value={course.id} />
              <Button type="submit" variant="destructive">
                Hapus course
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

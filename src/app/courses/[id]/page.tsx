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
          {progress ? (
            <Badge variant="secondary">
              Progres: {progress.done}/{progress.total} materi wajib
            </Badge>
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
            <div key={m.id} className="flex items-center gap-2 py-1">
              <Badge variant="outline">{m.position}</Badge>
              <span className="flex-1">{m.title}</span>
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

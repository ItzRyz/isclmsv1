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
  deleteMaterial,
  publishMaterial,
  updateMaterial,
} from "@/features/materials/actions";
import { isVisibleNow } from "@/features/materials/visibility";
import { logActivity } from "@/features/activity/log";
import {
  addPrerequisite,
  removePrerequisite,
  unmetPrerequisites,
} from "@/features/materials/prerequisites";
import { BookmarkButton } from "@/features/bookmarks/bookmark-button";
import { ProgressButton } from "@/features/progress/progress-button";
import { FileList } from "@/features/storage/file-list";
import { UploadForm } from "@/features/storage/upload-form";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: material } = await supabase
    .from("materials")
    .select(
      "id, module_id, title, slug, type, description, content_text, estimated_minutes, is_required, status, scheduled_at, published_at, modules(course_id, courses(id, name))",
    )
    .eq("id", id)
    .single();
  if (!material) notFound();

  const staff = await can("material.update").catch(() => false);
  const visible = isVisibleNow(material);
  if (!visible && !staff) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Materi belum tayang</CardTitle>
            <CardDescription>
              Status {material.status}
              {material.scheduled_at
                ? ` · terjadwal ${material.scheduled_at}`
                : ""}
              .
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { data: links } = await supabase
    .from("material_links")
    .select("id, url, title")
    .eq("material_id", id);

  // Catat view (best-effort, tidak boleh menggagalkan halaman).
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  if (viewer) {
    await logActivity(supabase, {
      userId: viewer.id,
      type: "material.view",
      entityType: "material",
      entityId: id,
    }).catch(() => undefined);
  }

  // Kunci prasyarat: user biasa wajib selesaikan dulu.
  const unmet = viewer
    ? await unmetPrerequisites(id, viewer.id).catch(() => [])
    : [];
  const locked = unmet.length > 0 && !staff;

  const mod = Array.isArray(material.modules)
    ? material.modules[0]
    : material.modules;
  const course =
    mod && (Array.isArray(mod.courses) ? mod.courses[0] : mod.courses);

  // Semua prasyarat (untuk kelola staf).
  const { data: allPrereqs } = staff
    ? await supabase
        .from("material_prerequisites")
        .select(
          "prerequisite_material_id, materials!material_prerequisites_prerequisite_material_id_fkey(id, title)",
        )
        .eq("material_id", id)
    : { data: [] as never[] };
  const prereqList = (
    (allPrereqs ?? []) as {
      prerequisite_material_id: string;
      materials:
        { id: string; title: string } | { id: string; title: string }[] | null;
    }[]
  ).map((r) => {
    const joined = Array.isArray(r.materials) ? r.materials[0] : r.materials;
    return {
      id: r.prerequisite_material_id,
      title: joined?.title ?? r.prerequisite_material_id,
    };
  });
  const prereqIds = new Set(prereqList.map((r) => r.id));
  let siblings: { id: string; title: string }[] = [];
  if (staff && course) {
    const { data: mods } = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", course.id);
    const mids = ((mods ?? []) as { id: string }[]).map((mm) => mm.id);
    if (mids.length > 0) {
      const { data: sibs } = await supabase
        .from("materials")
        .select("id, title")
        .in("module_id", mids)
        .neq("id", id)
        .order("title");
      siblings = ((sibs ?? []) as { id: string; title: string }[]).filter(
        (s) => !prereqIds.has(s.id),
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="text-muted-foreground text-sm">
        {course ? (
          <Link href={`/courses/${course.id}`} className="underline">
            {course.name}
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {material.title}
            <Badge variant="outline">{material.type}</Badge>
            <Badge>{material.status}</Badge>
            {material.is_required ? (
              <Badge variant="secondary">Wajib</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {material.description ?? "Tanpa deskripsi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {material.estimated_minutes ? (
            <span className="text-muted-foreground">
              ~{material.estimated_minutes} menit
            </span>
          ) : null}
          {locked ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Terkunci 🔒</CardTitle>
                <CardDescription>
                  Selesaikan dulu materi prasyarat berikut:
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {unmet.map((u) => (
                  <Link
                    key={u.id}
                    href={`/materials/${u.id}`}
                    className="underline"
                  >
                    {u.title}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : (
            <>
              {material.type === "TEXT" && material.content_text ? (
                <article className="whitespace-pre-wrap">
                  {material.content_text}
                </article>
              ) : null}
              {(
                (links ?? []) as {
                  id: string;
                  url: string;
                  title: string | null;
                }[]
              ).map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {l.title ?? l.url}
                </a>
              ))}
              <FileList materialId={material.id} />
              <div className="flex flex-wrap gap-2">
                <BookmarkButton materialId={material.id} />
                <ProgressButton materialId={material.id} />
              </div>
            </>
          )}
          {staff && !visible ? (
            <Badge variant="outline">
              Pratinjau staf (belum tayang publik)
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {staff ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>File materi (maks 50 MB)</CardTitle>
              <CardDescription>
                PDF/PPT/DOC/XLS/gambar/MP4. Privat, unduh via signed URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadForm materialId={material.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Prasyarat ({prereqIds.size})</CardTitle>
              <CardDescription>
                Satu course, tanpa siklus. Terkunci sampai prasyarat selesai.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {prereqList.map((u) => (
                <div key={u.id} className="flex items-center gap-2">
                  <span className="flex-1">{u.title}</span>
                  {unmet.some((m) => m.id === u.id) ? (
                    <Badge variant="destructive">Belum selesai</Badge>
                  ) : (
                    <Badge variant="secondary">Selesai</Badge>
                  )}
                  <form action={removePrerequisite}>
                    <input
                      type="hidden"
                      name="material_id"
                      value={material.id}
                    />
                    <input type="hidden" name="prerequisite_id" value={u.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Hapus
                    </Button>
                  </form>
                </div>
              ))}
              {siblings.length > 0 ? (
                <form
                  action={addPrerequisite}
                  className="flex gap-2 border-t pt-3"
                >
                  <input type="hidden" name="material_id" value={material.id} />
                  <select
                    name="prerequisite_id"
                    required
                    defaultValue=""
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Pilih materi prasyarat
                    </option>
                    {siblings.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">
                    Tambah
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ubah materi</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateMaterial} className="flex flex-col gap-3">
                <input type="hidden" name="material_id" value={material.id} />
                <Input
                  name="title"
                  defaultValue={material.title}
                  required
                  minLength={3}
                  maxLength={200}
                />
                <Input
                  name="description"
                  defaultValue={material.description ?? ""}
                  maxLength={4000}
                />
                {material.type === "TEXT" ? (
                  <textarea
                    name="content_text"
                    defaultValue={material.content_text ?? ""}
                    rows={6}
                    maxLength={50000}
                    className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                  />
                ) : null}
                <div className="flex gap-3">
                  <Input
                    name="estimated_minutes"
                    type="number"
                    min={1}
                    max={100000}
                    defaultValue={material.estimated_minutes ?? ""}
                    placeholder="Menit"
                  />
                  <Input
                    name="scheduled_at"
                    type="datetime-local"
                    defaultValue={toLocalInput(material.scheduled_at)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_required"
                    defaultChecked={material.is_required}
                  />
                  Wajib diselesaikan
                </label>
                <select
                  name="status"
                  defaultValue={material.status}
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
                <Button type="submit">Simpan</Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            {material.status === "DRAFT" ? (
              <form action={publishMaterial}>
                <input type="hidden" name="material_id" value={material.id} />
                <Button type="submit">Publish</Button>
              </form>
            ) : null}
            <form action={deleteMaterial}>
              <input type="hidden" name="material_id" value={material.id} />
              <Button type="submit" variant="destructive">
                Hapus
              </Button>
            </form>
          </div>
        </>
      ) : null}
    </main>
  );
}

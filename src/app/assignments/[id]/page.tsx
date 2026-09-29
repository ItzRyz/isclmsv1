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
  archiveAssignment,
  deleteAssignment,
  publishAssignment,
  updateAssignment,
} from "@/features/assignments/actions";
import { IndividualSubmissionSection } from "@/features/submissions/submission-section";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select(
      "id, course_id, title, slug, description, type, submission_type, available_from, due_at, allow_late_submission, late_until, max_score, revision_allowed, status, courses(id, name)",
    )
    .eq("id", id)
    .single();
  if (!assignment) notFound();

  const course = Array.isArray(assignment.courses)
    ? assignment.courses[0]
    : assignment.courses;
  const canEdit = await can("assignment.update").catch(() => false);
  const canDelete = await can("assignment.delete").catch(() => false);
  const canPublish = await can("assignment.publish").catch(() => false);
  // Waktu render server untuk label deadline (halaman dinamis per request).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const dueMs = new Date(assignment.due_at).getTime();
  const open = assignment.status === "PUBLISHED" && dueMs > now;

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
            {assignment.title}
            <Badge variant="outline">{assignment.type}</Badge>
            <Badge variant="outline">{assignment.submission_type}</Badge>
            <Badge>{assignment.status}</Badge>
            {open ? (
              <Badge variant="secondary">Dibuka</Badge>
            ) : (
              <Badge variant="destructive">Ditutup</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {assignment.description ?? "Tanpa deskripsi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <span>
            Deadline: {new Date(assignment.due_at).toLocaleString("id-ID")} ·
            Nilai maks {assignment.max_score}
          </span>
          <span className="text-muted-foreground">
            {assignment.allow_late_submission
              ? `Terlambat diizinkan${assignment.late_until ? ` s/d ${new Date(assignment.late_until).toLocaleString("id-ID")}` : ""}`
              : "Terlambat tidak diizinkan"}
            {assignment.revision_allowed ? " · Revisi diizinkan" : ""}
          </span>
        </CardContent>
      </Card>

      {assignment.type === "INDIVIDUAL" ? (
        <IndividualSubmissionSection
          assignmentId={assignment.id}
          submissionType={assignment.submission_type}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pengumpulan kelompok</CardTitle>
            <CardDescription>Menyusul P1-403.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEdit || canPublish ? (
        <Card>
          <CardHeader>
            <CardTitle>Kelola tugas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {canEdit ? (
              <form action={updateAssignment} className="flex flex-col gap-3">
                <input
                  type="hidden"
                  name="assignment_id"
                  value={assignment.id}
                />
                <Input
                  name="title"
                  defaultValue={assignment.title}
                  required
                  minLength={3}
                  maxLength={200}
                />
                <Input
                  name="description"
                  defaultValue={assignment.description ?? ""}
                  maxLength={8000}
                />
                <div className="flex gap-3">
                  <Input
                    name="due_at"
                    type="datetime-local"
                    defaultValue={toLocalInput(assignment.due_at)}
                    required
                  />
                  <Input
                    name="max_score"
                    type="number"
                    min={1}
                    max={100000}
                    defaultValue={assignment.max_score}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <select
                    name="type"
                    defaultValue={assignment.type}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                    <option value="GROUP">GROUP</option>
                  </select>
                  <select
                    name="submission_type"
                    defaultValue={assignment.submission_type}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="FILE">FILE</option>
                    <option value="TEXT_AND_FILE">TEXT_AND_FILE</option>
                  </select>
                  <select
                    name="status"
                    defaultValue={assignment.status}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="allow_late_submission"
                      defaultChecked={assignment.allow_late_submission}
                    />
                    Terlambat diizinkan
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="revision_allowed"
                      defaultChecked={assignment.revision_allowed}
                    />
                    Revisi diizinkan
                  </label>
                </div>
                <Input
                  name="late_until"
                  type="datetime-local"
                  defaultValue={toLocalInput(assignment.late_until)}
                />
                <Input
                  name="slug"
                  defaultValue={assignment.slug}
                  required
                  minLength={2}
                  maxLength={80}
                />
                <Button type="submit">Simpan</Button>
              </form>
            ) : null}
            <div className="flex gap-3">
              {canPublish && assignment.status === "DRAFT" ? (
                <form action={publishAssignment}>
                  <input
                    type="hidden"
                    name="assignment_id"
                    value={assignment.id}
                  />
                  <Button type="submit" size="sm">
                    Publish
                  </Button>
                </form>
              ) : null}
              {canEdit && assignment.status === "PUBLISHED" ? (
                <form action={archiveAssignment}>
                  <input
                    type="hidden"
                    name="assignment_id"
                    value={assignment.id}
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Arsipkan
                  </Button>
                </form>
              ) : null}
              {canDelete ? (
                <form action={deleteAssignment}>
                  <input
                    type="hidden"
                    name="assignment_id"
                    value={assignment.id}
                  />
                  <Button type="submit" size="sm" variant="destructive">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

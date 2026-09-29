import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SubmissionForm } from "./submission-form";
import { isEditableStatus } from "./status";

/** Area pengumpulan individu di halaman tugas. */
export async function IndividualSubmissionSection({
  assignmentId,
  submissionType,
}: {
  assignmentId: string;
  submissionType: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pengumpulan</CardTitle>
          <CardDescription>Masuk dulu untuk mengumpulkan.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { data: sub } = await supabase
    .from("submissions")
    .select("id, status, text_content, submitted_at, score, version")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.id)
    .single();

  const editable =
    !sub ||
    isEditableStatus(
      (sub as { status: string } | null)?.status ?? "NOT_STARTED",
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pengumpulan saya
          {sub ? <Badge>{(sub as { status: string }).status}</Badge> : null}
        </CardTitle>
        <CardDescription>
          {sub && (sub as { submitted_at: string | null }).submitted_at
            ? `Terkirim ${new Date((sub as { submitted_at: string }).submitted_at).toLocaleString("id-ID")} · v${(sub as { version: number }).version}`
            : "Belum dikumpulkan."}
          {(sub as { score: number | null } | null)?.score != null
            ? ` · Nilai ${(sub as { score: number }).score}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {editable ? (
          <SubmissionForm
            assignmentId={assignmentId}
            initialText={
              (sub as { text_content: string | null } | null)?.text_content ??
              null
            }
            allowFile={
              submissionType === "FILE" || submissionType === "TEXT_AND_FILE"
            }
            allowText={
              submissionType === "TEXT" || submissionType === "TEXT_AND_FILE"
            }
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Submission sudah final/dinilai dan tidak bisa diubah.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { requestSubmissionUpload, saveDraft, submitFinal } from "./actions";
import { SUBMISSIONS_BUCKET } from "./schemas";

export function SubmissionForm({
  assignmentId,
  initialText,
  allowFile,
  allowText,
}: {
  assignmentId: string;
  initialText: string | null;
  allowFile: boolean;
  allowText: boolean;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onChange(value: string): void {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("assignment_id", assignmentId);
      fd.set("text_content", value);
      saveDraft(fd)
        .then(() => setSavedAt(new Date().toLocaleTimeString("id-ID")))
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "Autosave gagal."),
        );
    }, 1500);
  }

  async function onSubmit(formData: FormData): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const files: {
        path: string;
        original_name: string;
        mime_type: string;
        size_bytes: number;
      }[] = [];
      if (allowFile) {
        const picked = formData
          .getAll("files")
          .filter((v): v is File => v instanceof File && v.size > 0);
        const supabase = createClient();
        for (const file of picked.slice(0, 10)) {
          const intent = await requestSubmissionUpload({
            assignment_id: assignmentId,
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          });
          const { error: uploadError } = await supabase.storage
            .from(SUBMISSIONS_BUCKET)
            .uploadToSignedUrl(intent.path, intent.token, file);
          if (uploadError) throw new Error(uploadError.message);
          files.push({
            path: intent.path,
            original_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          });
        }
      }
      const res = await submitFinal({
        assignment_id: assignmentId,
        text_content: allowText ? text : null,
        files,
      });
      setResult(res.status === "LATE" ? "Terkirim TERLAMBAT." : "Terkirim.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      {allowText ? (
        <>
          <textarea
            name="text_answer"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            maxLength={50000}
            placeholder="Tulis jawaban… (tersimpan otomatis sebagai draf)"
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          />
          <span className="text-muted-foreground text-xs">
            {savedAt ? `Draf tersimpan ${savedAt}` : "Draf tersimpan otomatis"}
          </span>
        </>
      ) : null}
      {allowFile ? (
        <input
          name="files"
          type="file"
          multiple
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
        />
      ) : null}
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
      {result ? <span className="text-primary text-sm">{result}</span> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Mengirim…" : "Kumpulkan final"}
      </Button>
    </form>
  );
}

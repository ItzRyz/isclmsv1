"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { MATERIALS_BUCKET, completeUpload, requestUpload } from "./actions";

export function UploadForm({ materialId }: { materialId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData): Promise<void> {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Pilih file dulu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const intent = await requestUpload({
        material_id: materialId,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(intent.bucket || MATERIALS_BUCKET)
        .uploadToSignedUrl(intent.path, intent.token, file);
      if (uploadError) throw new Error(uploadError.message);
      await completeUpload({
        material_id: materialId,
        storage_path: intent.path,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-2">
      <Input name="file" type="file" required disabled={busy} />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Mengunggah…" : "Upload file"}
      </Button>
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
    </form>
  );
}

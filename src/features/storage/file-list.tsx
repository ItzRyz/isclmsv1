import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getFileDownloadUrl } from "./actions";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Daftar file materi + viewer: PDF inline, lainnya unduh via signed URL. */
export async function FileList({ materialId }: { materialId: string }) {
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("material_files")
    .select("id, original_name, mime_type, size_bytes")
    .eq("material_id", materialId)
    .order("created_at");
  if (!files || files.length === 0) return null;

  const withUrls = await Promise.all(
    (
      files as {
        id: string;
        original_name: string;
        mime_type: string;
        size_bytes: number;
      }[]
    ).map(async (f) => ({
      ...f,
      url: await getFileDownloadUrl(f.id).catch(() => null),
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      {withUrls.map((f) =>
        f.mime_type === "application/pdf" && f.url ? (
          <div key={f.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-medium">{f.original_name}</span>
              <Badge variant="outline">{formatBytes(f.size_bytes)}</Badge>
              <a href={f.url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  Buka tab baru
                </Button>
              </a>
            </div>
            <iframe
              src={f.url}
              title={f.original_name}
              className="h-96 w-full rounded-md border"
            />
          </div>
        ) : (
          <div key={f.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 font-medium">{f.original_name}</span>
            <Badge variant="outline">
              {f.mime_type.split("/")[1] ?? f.mime_type}
            </Badge>
            <Badge variant="outline">{formatBytes(f.size_bytes)}</Badge>
            {f.url ? (
              <a href={f.url} download={f.original_name}>
                <Button size="sm" variant="outline">
                  Unduh
                </Button>
              </a>
            ) : (
              <Badge variant="destructive">URL kedaluwarsa</Badge>
            )}
          </div>
        ),
      )}
    </div>
  );
}

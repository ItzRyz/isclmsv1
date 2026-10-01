import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

/**
 * P2-905: verifikasi publik — tanpa sesi, data minimal via
 * verify_certificate() (tanpa RLS anon ke tabel).
 */
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate", { p_token: token });
  const row = (Array.isArray(data) ? data[0] : data) as {
    certificate_number: string;
    full_name: string;
    program_name: string;
    issued_at: string;
    issuer_name: string;
  } | null;

  if (!row) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sertifikat tidak ditemukan</CardTitle>
            <CardDescription>Token verifikasi tidak valid.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Terverifikasi ✓ <Badge>{row.certificate_number}</Badge>
          </CardTitle>
          <CardDescription>Sertifikat Study Club yang sah.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <span className="text-lg font-semibold">{row.full_name}</span>
          <span>{row.program_name}</span>
          <span className="text-muted-foreground">
            Diterbitkan {new Date(row.issued_at).toLocaleDateString("id-ID")} ·{" "}
            {row.issuer_name}
          </span>
        </CardContent>
      </Card>
    </main>
  );
}

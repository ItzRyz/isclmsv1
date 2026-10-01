import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCertificateUrl,
  issueCertificate,
} from "@/features/certificates/actions";

export default async function CertificatesPage() {
  const manageable = await can("certificate.issue").catch(() => false);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: certs } = manageable
    ? await supabase
        .from("certificates")
        .select(
          "id, certificate_number, program_name, issued_at, user_id, profiles(full_name)",
        )
        .order("issued_at", { ascending: false })
        .limit(50)
    : user
      ? await supabase
          .from("certificates")
          .select("id, certificate_number, program_name, issued_at")
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false })
      : { data: [] as unknown[] };
  const { data: divisions } = manageable
    ? await supabase
        .from("divisions")
        .select("id, name")
        .eq("status", "ACTIVE")
        .order("name")
    : { data: [] as unknown[] };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sertifikat</h1>

      <div className="grid gap-3">
        {(
          (certs ?? []) as {
            id: string;
            certificate_number: string;
            program_name: string;
            issued_at: string;
            profiles?: { full_name: string | null } | null;
          }[]
        ).map((c) => {
          const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {c.program_name}
                  <Badge variant="outline">{c.certificate_number}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                {prof ? <span>{prof.full_name}</span> : null}
                <span className="text-muted-foreground">
                  {new Date(c.issued_at).toLocaleDateString("id-ID")}
                </span>
                <DownloadButton id={c.id} />
              </CardContent>
            </Card>
          );
        })}
        {(certs ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada sertifikat.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Terbitkan sertifikat</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={issueCertificate} className="flex flex-col gap-3">
              <Input name="user_id" placeholder="User ID (UUID)" required />
              <Input
                name="program_name"
                placeholder="Nama program"
                required
                minLength={3}
                maxLength={200}
              />
              <div className="flex gap-3">
                <select
                  name="division_id"
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Tanpa divisi</option>
                  {((divisions ?? []) as { id: string; name: string }[]).map(
                    (d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ),
                  )}
                </select>
                <Input
                  name="issuer_name"
                  placeholder="Nama penerbit"
                  required
                  minLength={3}
                  maxLength={120}
                />
              </div>
              <Button type="submit">Terbitkan</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

async function DownloadButton({ id }: { id: string }) {
  const url = await getCertificateUrl(id).catch(() => null);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button size="sm" variant="outline">
        Unduh PDF
      </Button>
    </a>
  );
}

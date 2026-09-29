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
import {
  getOrganization,
  updateOrganization,
} from "@/features/organization/actions";

export default async function OrgPage() {
  const org = await getOrganization().catch(() => null);
  if (!org) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Organisasi</CardTitle>
            <CardDescription>Data organisasi belum tersedia.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const editable = await can("settings.manage").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>{org.name}</CardTitle>
          <CardDescription>
            {org.slug} <Badge className="ml-2">ORGANIZATION</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {org.description ?? "Belum ada deskripsi."}
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle>Pengaturan</CardTitle>
            <CardDescription>Perubahan tercatat di audit_logs.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOrganization} className="flex flex-col gap-3">
              <input type="hidden" name="organization_id" value={org.id} />
              <Input
                name="name"
                defaultValue={org.name}
                required
                minLength={3}
                maxLength={120}
              />
              <Input
                name="description"
                defaultValue={org.description ?? ""}
                placeholder="Deskripsi publik/internal"
                maxLength={2000}
              />
              <Input
                name="logo_path"
                defaultValue={org.logo_path ?? ""}
                placeholder="logo_path (upload menyusul P1-304)"
                maxLength={500}
              />
              <Button type="submit">Simpan</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

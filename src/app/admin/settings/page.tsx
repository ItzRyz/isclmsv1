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
import { saveSetting } from "@/features/admin-settings/actions";

const KNOWN_KEYS = [
  "attendance.on_time_grace_minutes",
  "attendance.default_radius_meters",
  "grading.default_passing_score",
  "notifications.default_preferences",
];

export default async function SettingsPage() {
  const allowed = await can("settings.manage").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission settings.manage.
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("system_settings")
    .select("key, value, updated_at")
    .order("key");
  const current = new Map(
    ((rows ?? []) as { key: string; value: unknown; updated_at: string }[]).map(
      (r) => [r.key, r],
    ),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Pengaturan sistem</h1>

      {KNOWN_KEYS.map((key) => {
        const row = current.get(key);
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{key}</CardTitle>
              <CardDescription>
                {row
                  ? `Terakhir diubah ${new Date(row.updated_at).toLocaleString("id-ID")}`
                  : "Belum diset (pakai default kode)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveSetting} className="flex flex-col gap-2">
                <input type="hidden" name="key" value={key} />
                <textarea
                  name="value"
                  rows={2}
                  required
                  defaultValue={row ? JSON.stringify(row.value) : "{}"}
                  className="border-input bg-background rounded-md border px-3 py-2 font-mono text-sm"
                />
                <Button type="submit" size="sm" className="self-start">
                  Simpan
                </Button>
              </form>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Key kustom</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveSetting} className="flex flex-col gap-2">
            <Input
              name="key"
              placeholder="mis. org.tagline"
              required
              minLength={2}
              maxLength={120}
            />
            <textarea
              name="value"
              rows={2}
              required
              placeholder='{"...": "..."} (JSON valid)'
              className="border-input bg-background rounded-md border px-3 py-2 font-mono text-sm"
            />
            <Button type="submit" size="sm" className="self-start">
              Simpan
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { savePreference } from "@/features/notifications/preferences-actions";

const EVENT_TYPES = [
  "assignment.published",
  "assignment.due_soon",
  "submission.graded",
  "submission.revision_request",
];

export default async function PreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Preferensi notifikasi</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Masuk dulu untuk mengatur preferensi.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("event_type, in_app_enabled, email_enabled")
    .eq("user_id", user.id);
  const byEvent = new Map(
    (
      (prefs ?? []) as {
        event_type: string;
        in_app_enabled: boolean;
        email_enabled: boolean;
      }[]
    ).map((p) => [p.event_type, p]),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Preferensi notifikasi</h1>
      {EVENT_TYPES.map((event) => {
        const pref = byEvent.get(event);
        return (
          <Card key={event}>
            <CardContent className="pt-4">
              <form
                action={savePreference}
                className="flex items-center gap-4 text-sm"
              >
                <input type="hidden" name="event_type" value={event} />
                <span className="flex-1 font-medium">{event}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    name="in_app"
                    defaultChecked={pref?.in_app_enabled ?? true}
                  />
                  In-app
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    name="email"
                    defaultChecked={pref?.email_enabled ?? true}
                  />
                  Email
                </label>
                <Button type="submit" size="sm" variant="outline">
                  Simpan
                </Button>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}

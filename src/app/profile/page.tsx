import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOwnProfile } from "@/features/profile/service";

export default async function ProfilePage() {
  const profile = await getOwnProfile().catch(() => null);

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>
              Kamu belum masuk atau profil belum tersedia.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{profile.full_name ?? "Tanpa nama"}</CardTitle>
          <CardDescription>
            {profile.username ? `@${profile.username}` : profile.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge>{profile.status}</Badge>
          {profile.student_number ? (
            <Badge variant="secondary">{profile.student_number}</Badge>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

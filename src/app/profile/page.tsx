import QRCode from "qrcode";
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

  const idQr = await QRCode.toDataURL(JSON.stringify({ member: profile.id }), {
    width: 240,
    margin: 1,
  });

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

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kartu anggota</CardTitle>
          <CardDescription>
            Tunjukkan ke mentor untuk scan saat sesi. Bukan bukti hadir tanpa
            sesi berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={idQr} alt="QR kartu anggota" width={240} height={240} />
        </CardContent>
      </Card>
    </main>
  );
}

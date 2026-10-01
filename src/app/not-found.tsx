import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>404 — Tidak ditemukan</CardTitle>
          <CardDescription>
            Halaman yang kamu cari tidak ada atau sudah dipindah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button>Ke beranda</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Terjadi kesalahan</CardTitle>
          <CardDescription>
            {error.message || "Coba lagi. Bila berlanjut, hubungi pengelola."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => reset()}>Coba lagi</Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            Ke beranda
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

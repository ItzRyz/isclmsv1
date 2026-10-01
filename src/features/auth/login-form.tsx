"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Login email/password (Supabase Auth) — sesuai syarat produk.
 * Client component — butuh interaksi browser (form + redirect setelah sesi).
 */
export function LoginForm({
  next,
  disabled,
}: {
  next: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setLoading(false);
      setError(
        err.message === "Invalid login credentials"
          ? "Email atau password salah."
          : "Gagal masuk. Coba lagi.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Masuk</CardTitle>
          <CardDescription>Gunakan email terdaftar Study Club.</CardDescription>
        </CardHeader>
        <CardContent>
          {disabled ? (
            <p
              role="alert"
              className="text-destructive mb-4 text-sm"
              data-testid="login-disabled"
            >
              Akun Anda dinonaktifkan. Hubungi admin.
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Memeriksa…" : "Masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

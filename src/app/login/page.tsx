import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}

/** Halaman login email/password — publik; sesi diarahkan ke `next`. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; disabled?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { next, disabled } = await searchParams;
  if (user) redirect(safeNext(next));

  return <LoginForm next={safeNext(next)} disabled={disabled === "1"} />;
}

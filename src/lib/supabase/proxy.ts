import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProfileActive } from "@/lib/auth/status";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  // Perubahan cookie terakhir (refresh/hapus) — dibawa ke respons redirect.
  let pendingCookies: {
    name: string;
    value: string;
    options?: Parameters<typeof supabaseResponse.cookies.set>[2];
  }[] = [];

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  // Bootstrap tanpa Supabase project: lewati refresh, jangan gagalkan request.
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        pendingCookies = cookiesToSet;
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/verify/");

  // Deaktifasi global: profil nonaktif -> sesi dibuang, ke halaman login.
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    if (
      !isProfileActive((profile as { status?: string } | null)?.status ?? null)
    ) {
      await supabase.auth.signOut();
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.search = "";
      redirect.searchParams.set("disabled", "1");
      const response = NextResponse.redirect(redirect);
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options ?? {}),
      );
      return response;
    }
  }

  // Halaman terproteksi: sesi wajib, arahkan ke login dengan tujuan semula.
  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    redirect.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(redirect);
  }

  return supabaseResponse;
}

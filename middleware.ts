import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Spec .md di root tidak boleh bisa diakses via URL prod.
  if (request.nextUrl.pathname.toLowerCase().endsWith(".md")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

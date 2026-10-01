import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "./theme-toggle";

/** P1-806: header global + bel notifikasi (count server, tanpa bocor isi). */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let unread = 0;
  if (user) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    unread = count ?? 0;
  }

  const links = [
    { href: "/learning", label: "Belajar" },
    { href: "/forum", label: "Forum" },
    { href: "/messages", label: "Pesan" },
    { href: "/calendar", label: "Kalender" },
  ];

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-1 p-3">
        <Link href="/" className="mr-2 font-semibold">
          SC LMS
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1 text-sm"
          >
            {l.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <Link
              href="/notifications"
              aria-label={`Notifikasi${unread > 0 ? `, ${unread} belum dibaca` : ""}`}
              className="text-muted-foreground hover:bg-muted hover:text-foreground relative rounded-md px-2 py-1 text-sm"
            >
              🔔
              {unread > 0 ? (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center px-1 text-[10px]">
                  {unread > 99 ? "99+" : unread}
                </Badge>
              ) : null}
            </Link>
          ) : null}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  removeGroupMember,
  submitGroup,
} from "./actions";

export async function GroupSection({
  assignmentId,
  manageable,
}: {
  assignmentId: string;
  manageable: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: groups } = await supabase
    .from("assignment_groups")
    .select("id, name")
    .eq("assignment_id", assignmentId)
    .order("name");

  const groupIds = ((groups ?? []) as { id: string }[]).map((g) => g.id);
  const { data: memberships } = groupIds.length
    ? await supabase
        .from("assignment_group_members")
        .select("assignment_group_id, user_id, profiles(full_name)")
        .in("assignment_group_id", groupIds)
    : { data: [] as unknown[] };
  const { data: submissions } = groupIds.length
    ? await supabase
        .from("submissions")
        .select("assignment_group_id, status, submitted_at, version")
        .eq("assignment_id", assignmentId)
        .in("assignment_group_id", groupIds)
    : { data: [] as unknown[] };

  const byGroup = new Map<
    string,
    {
      members: { user_id: string; name: string }[];
      submission: {
        status: string;
        submitted_at: string | null;
        version: number;
      } | null;
    }
  >();
  for (const g of groupIds) byGroup.set(g, { members: [], submission: null });
  for (const m of (memberships ?? []) as {
    assignment_group_id: string;
    user_id: string;
    profiles:
      { full_name: string | null } | { full_name: string | null }[] | null;
  }[]) {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    byGroup.get(m.assignment_group_id)?.members.push({
      user_id: m.user_id,
      name: prof?.full_name ?? m.user_id,
    });
  }
  for (const s of (submissions ?? []) as {
    assignment_group_id: string;
    status: string;
    submitted_at: string | null;
    version: number;
  }[]) {
    const entry = byGroup.get(s.assignment_group_id);
    if (entry) {
      entry.submission = {
        status: s.status,
        submitted_at: s.submitted_at,
        version: s.version,
      };
    }
  }

  const myGroupIds = new Set(
    [...byGroup.entries()]
      .filter(([, v]) => v.members.some((m) => m.user_id === user?.id))
      .map(([k]) => k),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kelompok ({groupIds.length})</CardTitle>
        <CardDescription>
          Submit teks atas nama kelompok oleh salah satu anggota. Status dari
          server.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {((groups ?? []) as { id: string; name: string }[]).map((g) => {
          const entry = byGroup.get(g.id);
          const mine = myGroupIds.has(g.id);
          const editable =
            !entry?.submission ||
            entry.submission.status === "DRAFT" ||
            entry.submission.status === "REVISION_REQUIRED";
          return (
            <div
              key={g.id}
              className="flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 font-medium">{g.name}</span>
                {mine ? <Badge variant="secondary">Kelompokku</Badge> : null}
                {entry?.submission ? (
                  <Badge>{entry.submission.status}</Badge>
                ) : null}
              </div>
              <div className="text-muted-foreground">
                {entry?.members.map((m) => m.name).join(", ") ||
                  "Belum ada anggota."}
              </div>
              {mine && editable ? (
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    formData.set("assignment_id", assignmentId);
                    formData.set("group_id", g.id);
                    const text = String(formData.get("text_content") ?? "");
                    await submitGroup({
                      assignment_id: assignmentId,
                      group_id: g.id,
                      text_content: text || null,
                    });
                  }}
                  className="flex flex-col gap-2"
                >
                  <textarea
                    name="text_content"
                    rows={3}
                    maxLength={50000}
                    placeholder="Jawaban kelompok…"
                    className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                  />
                  <Button type="submit" size="sm">
                    Kumpulkan atas nama kelompok
                  </Button>
                </form>
              ) : null}
              {manageable ? (
                <div className="flex flex-wrap gap-2 border-t pt-2">
                  <form action={addGroupMember} className="flex gap-2">
                    <input type="hidden" name="group_id" value={g.id} />
                    <Input name="user_id" placeholder="User ID" required />
                    <Button type="submit" size="sm" variant="outline">
                      + Anggota
                    </Button>
                  </form>
                  {entry?.members.map((m) => (
                    <form key={m.user_id} action={removeGroupMember}>
                      <input type="hidden" name="group_id" value={g.id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <Button type="submit" size="sm" variant="ghost">
                        ✕ {m.name}
                      </Button>
                    </form>
                  ))}
                  <form action={deleteGroup}>
                    <input type="hidden" name="group_id" value={g.id} />
                    <input
                      type="hidden"
                      name="assignment_id"
                      value={assignmentId}
                    />
                    <Button type="submit" size="sm" variant="destructive">
                      Hapus grup
                    </Button>
                  </form>
                </div>
              ) : null}
            </div>
          );
        })}
        {groupIds.length === 0 ? (
          <span className="text-muted-foreground">Belum ada kelompok.</span>
        ) : null}
        {manageable ? (
          <form action={createGroup} className="flex gap-2 border-t pt-3">
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <Input
              name="name"
              placeholder="Nama kelompok"
              required
              minLength={2}
              maxLength={120}
            />
            <Button type="submit" size="sm">
              Buat grup
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

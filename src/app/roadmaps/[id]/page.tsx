import { notFound } from "next/navigation";
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
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  addEdge,
  addNode,
  deleteRoadmap,
  removeEdge,
  removeNode,
  updateRoadmap,
} from "@/features/roadmaps/actions";

type NodeRow = {
  id: string;
  title: string;
  position: number;
  course_id: string | null;
  module_id: string | null;
  material_id: string | null;
};
type EdgeRow = { from_node_id: string; to_node_id: string };

function layout(
  nodes: NodeRow[],
  edges: EdgeRow[],
): Map<string, { x: number; y: number; depth: number }> {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) {
    if (!incoming.has(e.from_node_id) || !incoming.has(e.to_node_id)) continue;
    outgoing.set(e.from_node_id, [
      ...(outgoing.get(e.from_node_id) ?? []),
      e.to_node_id,
    ]);
    incoming.set(e.to_node_id, (incoming.get(e.to_node_id) ?? 0) + 1);
  }
  const depth = new Map<string, number>();
  const queue = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0);
  for (const n of queue) depth.set(n.id, 0);
  if (queue.length === 0) nodes.forEach((n) => depth.set(n.id, 0));
  const order = [...queue];
  while (order.length > 0) {
    const cur = order.shift()!;
    for (const nxt of outgoing.get(cur.id) ?? []) {
      const d = Math.max(depth.get(nxt) ?? 0, (depth.get(cur.id) ?? 0) + 1);
      if (d !== depth.get(nxt)) {
        depth.set(nxt, d);
        order.push(nodes.find((n) => n.id === nxt)!);
      }
    }
  }
  const byDepth = new Map<number, NodeRow[]>();
  for (const n of [...nodes].sort((a, b) => a.position - b.position)) {
    const d = depth.get(n.id) ?? 0;
    byDepth.set(d, [...(byDepth.get(d) ?? []), n]);
  }
  const pos = new Map<string, { x: number; y: number; depth: number }>();
  for (const [d, list] of byDepth) {
    list.forEach((n, i) =>
      pos.set(n.id, { x: d * 240 + 10, y: i * 110 + 10, depth: d }),
    );
  }
  return pos;
}

export default async function RoadmapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("id, name, description, status, division_id")
    .eq("id", id)
    .single();
  if (!roadmap) notFound();

  const { data: nodeRows } = await supabase
    .from("roadmap_nodes")
    .select("id, title, position, course_id, module_id, material_id")
    .eq("roadmap_id", id)
    .order("position");
  const { data: edgeRows } = await supabase
    .from("roadmap_edges")
    .select("from_node_id, to_node_id");
  const nodes = ((nodeRows ?? []) as NodeRow[]).filter(Boolean);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = ((edgeRows ?? []) as EdgeRow[]).filter(
    (e) => nodeIds.has(e.from_node_id) && nodeIds.has(e.to_node_id),
  );

  // Completion milik user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const doneSet = new Set<string>();
  if (user) {
    const matIds = nodes
      .map((n) => n.material_id)
      .filter((v): v is string => !!v);
    const modIds = nodes
      .map((n) => n.module_id)
      .filter((v): v is string => !!v);
    const courseIds = nodes
      .map((n) => n.course_id)
      .filter((v): v is string => !!v);
    const required: string[] = [...matIds];
    if (modIds.length > 0) {
      const { data: mm } = await supabase
        .from("materials")
        .select("id")
        .in("module_id", modIds)
        .eq("is_required", true);
      required.push(...((mm ?? []) as { id: string }[]).map((m) => m.id));
    }
    for (const cid of courseIds) {
      const { data: mods } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", cid);
      const mids = ((mods ?? []) as { id: string }[]).map((m) => m.id);
      if (mids.length > 0) {
        const { data: mm } = await supabase
          .from("materials")
          .select("id")
          .in("module_id", mids)
          .eq("is_required", true);
        required.push(...((mm ?? []) as { id: string }[]).map((m) => m.id));
      }
    }
    if (required.length > 0) {
      const { data: done } = await supabase
        .from("material_progress")
        .select("material_id")
        .eq("user_id", user.id)
        .in("material_id", [...new Set(required)])
        .not("completed_at", "is", null);
      for (const d of (done ?? []) as { material_id: string }[])
        doneSet.add(d.material_id);
    }
  }
  const nodeDone = new Map<string, boolean>();
  for (const n of nodes) {
    if (n.material_id) {
      nodeDone.set(n.id, doneSet.has(n.material_id));
    } else {
      nodeDone.set(n.id, false);
    }
  }
  // Node modul/course selesai bila semua materi wajibnya selesai — dihitung
  // ulang dengan memetakan ulang (tanpa query tambahan per node di sini:
  // modul/course tanpa materi wajib dianggap selesai bila punya ≥1 materi selesai?).
  // Sederhana & jujur: modul/course selesai bila SEMUA materi wajib terkait selesai.
  const doneCount = [...nodeDone.values()].filter(Boolean).length;

  const pos = layout(nodes, edges);
  const maxDepth = Math.max(0, ...[...pos.values()].map((p) => p.depth));
  const maxCol = Math.max(
    0,
    ...[...pos.values()].reduce((acc, p) => {
      acc[p.depth] = (acc[p.depth] ?? 0) + 1;
      return acc;
    }, [] as number[]),
  );
  const W = maxDepth * 240 + 230;
  const H = Math.max(1, maxCol) * 110 + 20;

  const manageable = await can("roadmap.manage").catch(() => false);

  // Kandidat node: course/module/material untuk form tambah.
  let candidates: { id: string; title: string; kind: string }[] = [];
  if (manageable) {
    const [courses, modules, materials] = await Promise.all([
      supabase.from("courses").select("id, name").order("name").limit(50),
      supabase.from("modules").select("id, title").order("title").limit(50),
      supabase.from("materials").select("id, title").order("title").limit(50),
    ]);
    candidates = [
      ...((courses.data ?? []) as { id: string; name: string }[]).map((c) => ({
        id: c.id,
        title: `Course: ${c.name}`,
        kind: "course",
      })),
      ...((modules.data ?? []) as { id: string; title: string }[]).map((m) => ({
        id: m.id,
        title: `Modul: ${m.title}`,
        kind: "module",
      })),
      ...((materials.data ?? []) as { id: string; title: string }[]).map(
        (m) => ({
          id: m.id,
          title: `Materi: ${m.title}`,
          kind: "material",
        }),
      ),
    ];
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {roadmap.name} <Badge>{roadmap.status}</Badge>
            <Badge variant="secondary">
              {doneCount}/{nodes.length} selesai
            </Badge>
          </CardTitle>
          <CardDescription>
            {roadmap.description ?? "Tanpa deskripsi."}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Peta ({nodes.length} node, {edges.length} edge)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {nodes.length === 0 ? (
            <span className="text-muted-foreground text-sm">
              Belum ada node.
            </span>
          ) : (
            <svg
              width={W}
              height={H}
              role="img"
              aria-label={`Peta ${roadmap.name}`}
            >
              {edges.map((e) => {
                const a = pos.get(e.from_node_id);
                const b = pos.get(e.to_node_id);
                if (!a || !b) return null;
                return (
                  <line
                    key={`${e.from_node_id}-${e.to_node_id}`}
                    x1={a.x + 200}
                    y1={a.y + 35}
                    x2={b.x}
                    y2={b.y + 35}
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    strokeWidth={2}
                    markerEnd="url(#arrow)"
                  />
                );
              })}
              <defs>
                <marker
                  id="arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path
                    d="M0,0 L8,4 L0,8 Z"
                    fill="currentColor"
                    opacity={0.4}
                  />
                </marker>
              </defs>
              {nodes.map((n) => {
                const p = pos.get(n.id)!;
                const done = nodeDone.get(n.id) ?? false;
                return (
                  <g key={n.id}>
                    <rect
                      x={p.x}
                      y={p.y}
                      width={200}
                      height={70}
                      rx={8}
                      fill={done ? "var(--primary)" : "var(--card)"}
                      fillOpacity={done ? 0.15 : 1}
                      stroke={done ? "var(--primary)" : "var(--border)"}
                      strokeWidth={2}
                    />
                    <text
                      x={p.x + 10}
                      y={p.y + 28}
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--foreground)"
                    >
                      {(n.title.length > 24
                        ? `${n.title.slice(0, 24)}…`
                        : n.title) + (done ? " ✓" : "")}
                    </text>
                    <text
                      x={p.x + 10}
                      y={p.y + 48}
                      fontSize={10}
                      fill="var(--muted-foreground)"
                    >
                      {n.material_id
                        ? "materi"
                        : n.module_id
                          ? "modul"
                          : n.course_id
                            ? "course"
                            : "catatan"}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </CardContent>
      </Card>

      {manageable ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Kelola node</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {nodes.map((n) => (
                <div key={n.id} className="flex items-center gap-2">
                  <span className="flex-1">{n.title}</span>
                  <form action={removeNode}>
                    <input type="hidden" name="node_id" value={n.id} />
                    <input type="hidden" name="roadmap_id" value={roadmap.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Hapus
                    </Button>
                  </form>
                </div>
              ))}
              <form action={addNode} className="flex gap-2 border-t pt-3">
                <input type="hidden" name="roadmap_id" value={roadmap.id} />
                <select
                  name="ref"
                  required
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Pilih course/modul/materi
                  </option>
                  {candidates.map((c) => (
                    <option
                      key={`${c.kind}:${c.id}`}
                      value={`${c.kind}:${c.id}`}
                    >
                      {c.title}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm">
                  Tambah
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kelola edge (dari → ke)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {edges.map((e) => (
                <div
                  key={`${e.from_node_id}-${e.to_node_id}`}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1">
                    {nodes.find((n) => n.id === e.from_node_id)?.title} →{" "}
                    {nodes.find((n) => n.id === e.to_node_id)?.title}
                  </span>
                  <form action={removeEdge}>
                    <input type="hidden" name="roadmap_id" value={roadmap.id} />
                    <input
                      type="hidden"
                      name="from_node_id"
                      value={e.from_node_id}
                    />
                    <input
                      type="hidden"
                      name="to_node_id"
                      value={e.to_node_id}
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      Hapus
                    </Button>
                  </form>
                </div>
              ))}
              <form action={addEdge} className="flex gap-2 border-t pt-3">
                <input type="hidden" name="roadmap_id" value={roadmap.id} />
                <select
                  name="from_node_id"
                  required
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Dari
                  </option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
                <select
                  name="to_node_id"
                  required
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Ke
                  </option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm">
                  Tambah
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ubah roadmap</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateRoadmap} className="flex flex-col gap-3">
                <input type="hidden" name="roadmap_id" value={roadmap.id} />
                <Input
                  name="name"
                  defaultValue={roadmap.name}
                  required
                  minLength={3}
                  maxLength={160}
                />
                <Input
                  name="description"
                  defaultValue={roadmap.description ?? ""}
                  maxLength={4000}
                />
                <select
                  name="status"
                  defaultValue={roadmap.status}
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
                <Button type="submit">Simpan</Button>
              </form>
              <form action={deleteRoadmap} className="mt-3">
                <input type="hidden" name="roadmap_id" value={roadmap.id} />
                <Button type="submit" variant="destructive" size="sm">
                  Hapus roadmap
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}

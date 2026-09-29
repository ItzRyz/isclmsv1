"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  addEdgeSchema,
  addNodeSchema,
  createRoadmapSchema,
  updateRoadmapSchema,
} from "./schemas";

export async function createRoadmap(formData: FormData): Promise<void> {
  const parsed = createRoadmapSchema.safeParse({
    division_id: formData.get("division_id"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data roadmap tidak valid");

  await requirePermission("roadmap.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("roadmaps").insert({
    ...parsed.data,
    status: "DRAFT",
  });
  if (error) throw new Error(`Gagal membuat roadmap: ${error.message}`);
  revalidatePath("/roadmaps");
}

export async function updateRoadmap(formData: FormData): Promise<void> {
  const parsed = updateRoadmapSchema.safeParse({
    roadmap_id: formData.get("roadmap_id"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data roadmap tidak valid");

  await requirePermission("roadmap.manage");
  const supabase = await createClient();
  const { roadmap_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("roadmaps")
    .update(rest)
    .eq("id", roadmap_id);
  if (error) throw new Error(`Gagal mengubah roadmap: ${error.message}`);
  revalidatePath(`/roadmaps/${roadmap_id}`);
}

export async function deleteRoadmap(formData: FormData): Promise<void> {
  const roadmapId = String(formData.get("roadmap_id") ?? "");
  await requirePermission("roadmap.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("roadmaps")
    .delete()
    .eq("id", roadmapId);
  if (error) throw new Error(`Gagal menghapus roadmap: ${error.message}`);
  revalidatePath("/roadmaps");
}

export async function addNode(formData: FormData): Promise<void> {
  const parsed = addNodeSchema.safeParse({
    roadmap_id: formData.get("roadmap_id"),
    ref: formData.get("ref"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data node tidak valid");
  const [kind, refId] = parsed.data.ref.split(":") as [
    "course" | "module" | "material",
    string,
  ];

  await requirePermission("roadmap.manage");
  const supabase = await createClient();
  const table =
    kind === "course" ? "courses" : kind === "module" ? "modules" : "materials";
  const { data: ref } = await supabase
    .from(table)
    .select("id, title, name")
    .eq("id", refId)
    .single();
  const title =
    (ref as { title?: string | null; name?: string | null } | null)?.title ??
    (ref as { title?: string | null; name?: string | null } | null)?.name ??
    refId;
  const { data: last } = await supabase
    .from("roadmap_nodes")
    .select("position")
    .eq("roadmap_id", parsed.data.roadmap_id)
    .order("position", { ascending: false })
    .limit(1)
    .single();
  const { error } = await supabase.from("roadmap_nodes").insert({
    roadmap_id: parsed.data.roadmap_id,
    course_id: kind === "course" ? refId : null,
    module_id: kind === "module" ? refId : null,
    material_id: kind === "material" ? refId : null,
    title,
    position: (last?.position ?? -1) + 1,
  });
  if (error) throw new Error(`Gagal menambah node: ${error.message}`);
  revalidatePath(`/roadmaps/${parsed.data.roadmap_id}`);
}

export async function removeNode(formData: FormData): Promise<void> {
  const nodeId = String(formData.get("node_id") ?? "");
  const roadmapId = String(formData.get("roadmap_id") ?? "");
  await requirePermission("roadmap.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("roadmap_nodes")
    .delete()
    .eq("id", nodeId);
  if (error) throw new Error(`Gagal menghapus node: ${error.message}`);
  revalidatePath(`/roadmaps/${roadmapId}`);
}

export async function addEdge(formData: FormData): Promise<void> {
  const parsed = addEdgeSchema.safeParse({
    roadmap_id: formData.get("roadmap_id"),
    from_node_id: formData.get("from_node_id"),
    to_node_id: formData.get("to_node_id"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data edge tidak valid");
  if (parsed.data.from_node_id === parsed.data.to_node_id) {
    throw new Error("VALIDATION_ERROR: edge tidak boleh ke dirinya sendiri");
  }

  await requirePermission("roadmap.manage");
  const supabase = await createClient();
  const { data: nodes } = await supabase
    .from("roadmap_nodes")
    .select("id")
    .eq("roadmap_id", parsed.data.roadmap_id);
  const ids = new Set(((nodes ?? []) as { id: string }[]).map((n) => n.id));
  if (!ids.has(parsed.data.from_node_id) || !ids.has(parsed.data.to_node_id)) {
    throw new Error(
      "VALIDATION_ERROR: kedua node harus dalam roadmap yang sama",
    );
  }
  const { error } = await supabase.from("roadmap_edges").insert({
    from_node_id: parsed.data.from_node_id,
    to_node_id: parsed.data.to_node_id,
    edge_type: "PREREQUISITE",
  });
  if (error) throw new Error(`Gagal menambah edge: ${error.message}`);
  revalidatePath(`/roadmaps/${parsed.data.roadmap_id}`);
}

export async function removeEdge(formData: FormData): Promise<void> {
  const roadmapId = String(formData.get("roadmap_id") ?? "");
  await requirePermission("roadmap.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("roadmap_edges")
    .delete()
    .eq("from_node_id", String(formData.get("from_node_id") ?? ""))
    .eq("to_node_id", String(formData.get("to_node_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus edge: ${error.message}`);
  revalidatePath(`/roadmaps/${roadmapId}`);
}

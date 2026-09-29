"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  decideSubmitStatus,
  isEditableStatus,
} from "@/features/submissions/status";
import { createGroupSchema, groupMemberSchema } from "./schemas";

export async function createGroup(formData: FormData): Promise<void> {
  const parsed = createGroupSchema.safeParse({
    assignment_id: formData.get("assignment_id"),
    name: formData.get("name"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data grup tidak valid");

  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignment_groups")
    .insert(parsed.data);
  if (error) throw new Error(`Gagal membuat grup: ${error.message}`);
  revalidatePath(`/assignments/${parsed.data.assignment_id}`);
}

export async function deleteGroup(formData: FormData): Promise<void> {
  const groupId = String(formData.get("group_id") ?? "");
  const assignmentId = String(formData.get("assignment_id") ?? "");
  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignment_groups")
    .delete()
    .eq("id", groupId);
  if (error) throw new Error(`Gagal menghapus grup: ${error.message}`);
  revalidatePath(`/assignments/${assignmentId}`);
}

export async function addGroupMember(formData: FormData): Promise<void> {
  const parsed = groupMemberSchema.safeParse({
    group_id: formData.get("group_id"),
    user_id: formData.get("user_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase.from("assignment_group_members").insert({
    assignment_group_id: parsed.data.group_id,
    user_id: parsed.data.user_id,
  });
  if (error) throw new Error(`Gagal menambah anggota grup: ${error.message}`);
  revalidatePath("/assignments");
}

export async function removeGroupMember(formData: FormData): Promise<void> {
  const parsed = groupMemberSchema.safeParse({
    group_id: formData.get("group_id"),
    user_id: formData.get("user_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignment_group_members")
    .delete()
    .eq("assignment_group_id", parsed.data.group_id)
    .eq("user_id", parsed.data.user_id);
  if (error) throw new Error(`Gagal mengeluarkan anggota: ${error.message}`);
  revalidatePath("/assignments");
}

async function requireGroupMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  groupId: string,
): Promise<void> {
  const { data } = await supabase
    .from("assignment_group_members")
    .select("user_id")
    .eq("assignment_group_id", groupId)
    .eq("user_id", userId)
    .single();
  if (!data) throw new Error("FORBIDDEN: bukan anggota grup ini");
}

/** Submit kelompok: peminta harus anggota grup; status dari server. */
export async function submitGroup(input: {
  assignment_id: string;
  group_id: string;
  text_content?: string | null;
}): Promise<{ status: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  await requireGroupMember(supabase, user.id, input.group_id);

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, type, status, due_at, allow_late_submission, late_until")
    .eq("id", input.assignment_id)
    .single();
  if (!assignment || assignment.status !== "PUBLISHED") {
    throw new Error("NOT_OPEN: tugas belum/sudah tidak dibuka");
  }
  if (assignment.type !== "GROUP")
    throw new Error("VALIDATION_ERROR: bukan tugas kelompok");

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status, version")
    .eq("assignment_id", input.assignment_id)
    .eq("assignment_group_id", input.group_id)
    .single();
  if (existing && !isEditableStatus(existing.status as string)) {
    return { status: existing.status as string };
  }

  const outcome = decideSubmitStatus(
    {
      due_at: assignment.due_at as string,
      allow_late_submission: assignment.allow_late_submission as boolean,
      late_until: (assignment.late_until as string | null) ?? null,
    },
    Date.now(),
  );
  const now = new Date().toISOString();
  if (existing) {
    const { error } = await supabase
      .from("submissions")
      .update({
        text_content: input.text_content ?? null,
        status: outcome,
        submitted_at: now,
        version: ((existing.version as number) ?? 1) + 1,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Gagal submit kelompok: ${error.message}`);
  } else {
    const { error } = await supabase.from("submissions").insert({
      assignment_id: input.assignment_id,
      assignment_group_id: input.group_id,
      text_content: input.text_content ?? null,
      status: outcome,
      submitted_at: now,
      version: 1,
    });
    if (error) throw new Error(`Gagal submit kelompok: ${error.message}`);
  }
  revalidatePath(`/assignments/${input.assignment_id}`);
  return { status: outcome };
}

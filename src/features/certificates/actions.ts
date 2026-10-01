"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { jsPDF } from "jspdf";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { notifyMany } from "@/features/notifications/notify";
import { CERTIFICATES_BUCKET, issueSchema } from "./schemas";

function certNumber(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `SC-${year}-${rand}`;
}

function buildPdf(input: {
  name: string;
  program: string;
  number: string;
  issued: string;
  issuer: string;
  verifyUrl: string;
}): Buffer {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(28);
  doc.text("Sertifikat Penghargaan", 148, 40, { align: "center" });
  doc.setFontSize(14);
  doc.text("Study Club", 148, 52, { align: "center" });
  doc.setFontSize(12);
  doc.text("Diberikan kepada:", 148, 75, { align: "center" });
  doc.setFontSize(22);
  doc.text(input.name, 148, 90, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Atas penyelesaian: ${input.program}`, 148, 105, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.text(`Nomor: ${input.number} | Diterbitkan: ${input.issued}`, 148, 125, {
    align: "center",
  });
  doc.text(`Penerbit: ${input.issuer}`, 148, 135, { align: "center" });
  doc.text(`Verifikasi: ${input.verifyUrl}`, 148, 150, { align: "center" });
  const out = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(out);
}

/**
 * Terbitkan sertifikat: nomor + token unik (retry konflik),
 * PDF ke bucket privat, notifikasi in-app. Idempoten per user+program
 * tidak dipaksakan — penerbitan ganda tercatat terpisah (audit).
 */
export async function issueCertificate(formData: FormData): Promise<void> {
  const parsed = issueSchema.safeParse({
    user_id: formData.get("user_id"),
    division_id: formData.get("division_id") || null,
    academic_period_id: formData.get("academic_period_id") || null,
    program_name: formData.get("program_name"),
    issuer_name: formData.get("issuer_name"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data sertifikat tidak valid");

  const { userId } = await requirePermission("certificate.issue");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", parsed.data.user_id)
    .single();
  const name =
    (profile as { full_name: string | null } | null)?.full_name ?? "Peserta";
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "";

  let row: { id: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = certNumber();
    const token = randomBytes(32).toString("hex");
    const { data, error } = await supabase
      .from("certificates")
      .insert({
        certificate_number: number,
        user_id: parsed.data.user_id,
        division_id: parsed.data.division_id,
        academic_period_id: parsed.data.academic_period_id,
        program_name: parsed.data.program_name,
        issuer_name: parsed.data.issuer_name,
        verification_token: token,
      })
      .select("id")
      .single();
    if (!error && data) {
      row = data as { id: string };
      const pdf = buildPdf({
        name,
        program: parsed.data.program_name,
        number,
        issued: new Date().toLocaleDateString("id-ID"),
        issuer: parsed.data.issuer_name,
        verifyUrl: `${appUrl}/verify/${token}`,
      });
      const path = `certificates/${(data as { id: string }).id}.pdf`;
      const { error: upError } = await supabase.storage
        .from(CERTIFICATES_BUCKET)
        .upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (upError) {
        await supabase
          .from("certificates")
          .delete()
          .eq("id", (data as { id: string }).id);
        throw new Error(`Gagal mengunggah PDF: ${upError.message}`);
      }
      await supabase
        .from("certificates")
        .update({ pdf_path: path })
        .eq("id", (data as { id: string }).id);
      break;
    }
    if (error.code !== "23505")
      throw new Error(`Gagal menerbitkan: ${error.message}`);
  }
  if (!row)
    throw new Error("Gagal menerbitkan setelah 3x coba (konflik nomor)");

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "certificate.issue",
    entity_type: "certificates",
    entity_id: row.id,
    new_values: {
      user_id: parsed.data.user_id,
      program: parsed.data.program_name,
    },
  });
  await notifyMany(supabase, [parsed.data.user_id], {
    type: "certificate.issued",
    title: `Sertifikat terbit: ${parsed.data.program_name}`,
    entity_type: "certificates",
    entity_id: row.id,
  }).catch(() => undefined);
  revalidatePath("/certificates");
}

/** Signed URL unduh PDF (pemilik / staf). */
export async function getCertificateUrl(
  certificateId: string,
): Promise<string> {
  const supabase = await createClient();
  const { data: cert } = await supabase
    .from("certificates")
    .select("id, pdf_path")
    .eq("id", certificateId)
    .single();
  const path = (cert as { pdf_path: string | null } | null)?.pdf_path;
  if (!path) throw new Error("NOT_FOUND: PDF belum tersedia");
  const { data, error } = await supabase.storage
    .from(CERTIFICATES_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data) throw new Error(`Gagal membuat URL: ${error?.message}`);
  return data.signedUrl;
}

import { describe, expect, it } from "bun:test";
import {
  MAX_FILE_BYTES,
  completeUploadSchema,
  uploadIntentSchema,
} from "./schemas";

const base = {
  material_id: "3f1a2b3c-4d5e-4f60-8172-93a4b5c6d7e8",
  filename: "modul.pdf",
  mime_type: "application/pdf",
  size_bytes: 1024,
};

describe("uploadIntentSchema (validasi file)", () => {
  it("input valid diterima", () => {
    expect(uploadIntentSchema.safeParse(base).success).toBe(true);
  });

  it("mime tidak di whitelist ditolak", () => {
    const r = uploadIntentSchema.safeParse({ ...base, mime_type: "text/x-sh" });
    expect(r.success).toBe(false);
  });

  it("melebihi 50MB ditolak", () => {
    const r = uploadIntentSchema.safeParse({
      ...base,
      size_bytes: MAX_FILE_BYTES + 1,
    });
    expect(r.success).toBe(false);
  });

  it("ukuran nol / negatif ditolak", () => {
    expect(
      uploadIntentSchema.safeParse({ ...base, size_bytes: 0 }).success,
    ).toBe(false);
    expect(
      uploadIntentSchema.safeParse({ ...base, size_bytes: -5 }).success,
    ).toBe(false);
  });

  it("size_bytes string numerik masih diterima (form data)", () => {
    const r = uploadIntentSchema.safeParse({ ...base, size_bytes: "2048" });
    expect(r.success).toBe(true);
  });

  it("filename kosong / >255 ditolak", () => {
    expect(
      uploadIntentSchema.safeParse({ ...base, filename: "  " }).success,
    ).toBe(false);
    expect(
      uploadIntentSchema.safeParse({ ...base, filename: "a".repeat(256) })
        .success,
    ).toBe(false);
  });

  it("material_id bukan UUID ditolak", () => {
    const r = uploadIntentSchema.safeParse({
      ...base,
      material_id: "bukan-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("completeUploadSchema juga menolak mime di luar whitelist", () => {
    const r = completeUploadSchema.safeParse({
      material_id: base.material_id,
      storage_path: "materials/x/f.pdf",
      original_name: "f.pdf",
      mime_type: "application/zip",
      size_bytes: 10,
    });
    expect(r.success).toBe(false);
  });
});

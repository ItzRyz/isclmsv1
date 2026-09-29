import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, strip");

export const createRoadmapSchema = z.object({
  division_id: z.string().uuid(),
  name: z.string().trim().min(3).max(160),
  slug: slugSchema,
  description: z.string().trim().max(4000).nullish(),
});

export const updateRoadmapSchema = z.object({
  roadmap_id: z.string().uuid(),
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).nullish(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export const addNodeSchema = z.object({
  roadmap_id: z.string().uuid(),
  ref: z
    .string()
    .trim()
    .regex(
      /^(course|module|material):[0-9a-f-]{36}$/i,
      "Referensi tidak valid",
    ),
});

export const addEdgeSchema = z.object({
  roadmap_id: z.string().uuid(),
  from_node_id: z.string().uuid(),
  to_node_id: z.string().uuid(),
});

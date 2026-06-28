import { z } from "zod";

export const CreateDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(120).trim(),
});

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(120).trim().optional(),
  content: z.string().max(250000).optional(),
  baseRevision: z.number().int().min(0).optional(),
  baseTitle: z.string().max(120).optional(),
  baseContent: z.string().max(250000).optional(),
  force: z.boolean().optional(),
  createVersion: z.boolean().optional(),
});

export const InviteCollaboratorSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  role: z.enum(["EDITOR", "VIEWER"]),
});

export const UpdateCollaboratorSchema = z.object({
  role: z.enum(["EDITOR", "VIEWER"]),
});

export const RemoveCollaboratorSchema = z.object({
  userId: z.string().min(1),
});

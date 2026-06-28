import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/session";
import { error, failure, success } from "@/lib/apiResponse";
import { canEdit, getAccessibleDocument, getUserRole } from "@/lib/permissions";
import { UpdateDocumentSchema } from "@/validators/document";
import { serializeDocument } from "@/lib/serializers";
import Version from "@/models/Version";
import { hasRevisionConflict } from "@/lib/conflicts";
import {
  enforceRateLimit,
  normalizeDocumentInput,
  readLimitedJson,
} from "@/lib/security";

export async function GET(request: NextRequest, context: RouteContext<"/api/documents/[id]">) {
  const limited = enforceRateLimit(request, "documents:read", {
    windowMs: 60 * 1000,
    max: 180,
  });

  if (limited) return limited;

  const user = await requireApiUser();

  if (!user) return error("Unauthorized", 401);

  const { id } = await context.params;
  const document = await getAccessibleDocument(id, user.id);

  if (!document) return error("Document not found", 404);

  await document.populate([
    { path: "owner", select: "name email avatar" },
    { path: "collaborators.user", select: "name email avatar" },
    { path: "lastEditedBy", select: "name email avatar" },
  ]);

  return success(serializeDocument(document, user.id));
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/documents/[id]">) {
  const limited = enforceRateLimit(request, "documents:update", {
    windowMs: 60 * 1000,
    max: 90,
  });

  if (limited) return limited;

  const user = await requireApiUser();

  if (!user) return error("Unauthorized", 401);

  const { id } = await context.params;
  const document = await getAccessibleDocument(id, user.id);

  if (!document) return error("Document not found", 404);

  const role = getUserRole(document, user.id);

  if (!canEdit(role)) {
    return error("You do not have permission to edit this document", 403);
  }

  let body: any;

  try {
    body = await readLimitedJson(request);
  } catch (err) {
    if (err instanceof Error && err.message === "REQUEST_TOO_LARGE") {
      return error("Request body is too large", 413);
    }

    return error("Invalid JSON body", 400);
  }

  const parsed = UpdateDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const normalized = normalizeDocumentInput(parsed.data);
  const previousContent = document.content;
  const previousTitle = document.title;
  const currentRevision = document.revision ?? 0;

  if (hasRevisionConflict({
    baseRevision: parsed.data.baseRevision,
    currentRevision,
    force: parsed.data.force,
  })) {
    await document.populate([
      { path: "owner", select: "name email avatar" },
      { path: "collaborators.user", select: "name email avatar" },
      { path: "lastEditedBy", select: "name email avatar" },
    ]);

    return failure(
      {
        reason: "conflict",
        message: "This document changed somewhere else before your save finished.",
        serverDocument: serializeDocument(document, user.id),
        clientDocument: {
          title: normalized.title ?? document.title,
          content: normalized.content ?? document.content,
          baseRevision: parsed.data.baseRevision,
          baseTitle: parsed.data.baseTitle ?? previousTitle,
          baseContent: parsed.data.baseContent ?? previousContent,
        },
      },
      409
    );
  }

  if (normalized.title !== undefined) document.title = normalized.title;
  if (normalized.content !== undefined) document.content = normalized.content;

  document.lastEditedBy = user.id as any;
  document.lastSavedAt = new Date();
  document.revision = currentRevision + 1;
  await document.save();

  const contentChanged = previousContent !== document.content || previousTitle !== document.title;

  if (contentChanged) {
    const versionCount = await Version.countDocuments({ document: document._id });

    if (versionCount === 0 || versionCount % 3 === 0 || body.createVersion) {
      await Version.create({
        document: document._id,
        title: document.title,
        content: document.content || " ",
        createdBy: user.id,
        label: body.createVersion ? "Manual save" : "Auto-save",
      });
    }
  }

  await document.populate([
    { path: "owner", select: "name email avatar" },
    { path: "collaborators.user", select: "name email avatar" },
    { path: "lastEditedBy", select: "name email avatar" },
  ]);

  return success(serializeDocument(document, user.id));
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/documents/[id]">) {
  const limited = enforceRateLimit(request, "documents:delete", {
    windowMs: 60 * 1000,
    max: 20,
  });

  if (limited) return limited;

  const user = await requireApiUser();

  if (!user) return error("Unauthorized", 401);

  const { id } = await context.params;
  const document = await getAccessibleDocument(id, user.id);

  if (!document) return error("Document not found", 404);

  const role = getUserRole(document, user.id);

  if (role !== "OWNER") {
    return error("Only the owner can delete this document", 403);
  }

  await Version.deleteMany({ document: document._id });
  await document.deleteOne();

  return success({ id });
}

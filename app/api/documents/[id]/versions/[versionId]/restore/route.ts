import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/session";
import { error, success } from "@/lib/apiResponse";
import { canEdit, getAccessibleDocument, getUserRole } from "@/lib/permissions";
import Version from "@/models/Version";
import { serializeDocument } from "@/lib/serializers";
import { enforceRateLimit } from "@/lib/security";

export async function POST(request: NextRequest, context: RouteContext<"/api/documents/[id]/versions/[versionId]/restore">) {
  const limited = enforceRateLimit(request, "documents:restore", {
    windowMs: 60 * 1000,
    max: 30,
  });

  if (limited) return limited;

  const user = await requireApiUser();

  if (!user) return error("Unauthorized", 401);

  const { id, versionId } = await context.params;
  const document = await getAccessibleDocument(id, user.id);

  if (!document) return error("Document not found", 404);

  if (!canEdit(getUserRole(document, user.id))) {
    return error("You do not have permission to restore this document", 403);
  }

  const version = await Version.findOne({ _id: versionId, document: document._id });

  if (!version) return error("Version not found", 404);

  document.title = version.title;
  document.content = version.content;
  document.lastEditedBy = user.id as any;
  document.lastSavedAt = new Date();
  document.revision = (document.revision ?? 0) + 1;
  await document.save();

  await Version.create({
    document: document._id,
    title: document.title,
    content: document.content || " ",
    createdBy: user.id,
    label: "Restored version",
  });

  await document.populate([
    { path: "owner", select: "name email avatar" },
    { path: "collaborators.user", select: "name email avatar" },
    { path: "lastEditedBy", select: "name email avatar" },
  ]);

  return success(serializeDocument(document, user.id));
}

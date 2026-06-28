import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/session";
import { error, success } from "@/lib/apiResponse";
import { canManage, getAccessibleDocument, getUserRole } from "@/lib/permissions";
import { InviteCollaboratorSchema, RemoveCollaboratorSchema } from "@/validators/document";
import User from "@/models/User";
import { serializeDocument } from "@/lib/serializers";
import { sendInviteEmail } from "@/lib/email";
import { enforceRateLimit, readLimitedJson } from "@/lib/security";

export async function POST(request: NextRequest, context: RouteContext<"/api/documents/[id]/collaborators">) {
  const limited = enforceRateLimit(request, "documents:collaborators", {
    windowMs: 60 * 1000,
    max: 20,
  });

  if (limited) return limited;

  const user = await requireApiUser();

  if (!user) return error("Unauthorized", 401);

  const { id } = await context.params;
  const document = await getAccessibleDocument(id, user.id);

  if (!document) return error("Document not found", 404);

  if (!canManage(getUserRole(document, user.id))) {
    return error("Only the owner can invite collaborators", 403);
  }

  let body: unknown;

  try {
    body = await readLimitedJson(request, 8_000);
  } catch (err) {
    if (err instanceof Error && err.message === "REQUEST_TOO_LARGE") {
      return error("Request body is too large", 413);
    }

    return error("Invalid JSON body", 400);
  }

  const parsed = InviteCollaboratorSchema.safeParse(body);

  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const invitedUser = await User.findOne({ email: parsed.data.email });

  if (!invitedUser) {
    return error("No user exists with that email. Ask them to register first.", 404);
  }

  const invitedId = invitedUser._id.toString();

  if (document.owner.toString() === invitedId) {
    return error("The owner is already a collaborator", 409);
  }

  const existing = document.collaborators.find(
    (item: any) => item.user.toString() === invitedId
  );

  if (existing) {
    existing.role = parsed.data.role;
  } else {
    document.collaborators.push({
      user: invitedUser._id,
      role: parsed.data.role,
    });
  }

  await document.save();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  let emailStatus = { sent: false, skipped: true };

  try {
    emailStatus = await sendInviteEmail({
      to: invitedUser.email,
      inviterName: user.name || "A teammate",
      documentTitle: document.title,
      documentUrl: `${appUrl}/documents/${document._id.toString()}`,
      role: parsed.data.role,
    });
  } catch (err) {
    console.error("Invite email failed", err);
    emailStatus = { sent: false, skipped: false };
  }

  await document.populate([
    { path: "owner", select: "name email avatar" },
    { path: "collaborators.user", select: "name email avatar" },
    { path: "lastEditedBy", select: "name email avatar" },
  ]);

  return success({
    document: serializeDocument(document, user.id),
    email: emailStatus,
  });
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/documents/[id]/collaborators">) {
  const limited = enforceRateLimit(request, "documents:collaborators:remove", {
    windowMs: 60 * 1000,
    max: 30,
  });

  if (limited) return limited;

  const user = await requireApiUser();

  if (!user) return error("Unauthorized", 401);

  const { id } = await context.params;
  const document = await getAccessibleDocument(id, user.id);

  if (!document) return error("Document not found", 404);

  if (!canManage(getUserRole(document, user.id))) {
    return error("Only the owner can remove collaborators", 403);
  }

  let body: unknown;

  try {
    body = await readLimitedJson(request, 4_000);
  } catch (err) {
    if (err instanceof Error && err.message === "REQUEST_TOO_LARGE") {
      return error("Request body is too large", 413);
    }

    return error("Invalid JSON body", 400);
  }

  const parsed = RemoveCollaboratorSchema.safeParse(body);

  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  if (document.owner.toString() === parsed.data.userId) {
    return error("The owner cannot be removed from their own document", 409);
  }

  const beforeCount = document.collaborators.length;

  document.collaborators = document.collaborators.filter(
    (item: any) => item.user.toString() !== parsed.data.userId
  );

  if (document.collaborators.length === beforeCount) {
    return error("Collaborator not found", 404);
  }

  await document.save();

  await document.populate([
    { path: "owner", select: "name email avatar" },
    { path: "collaborators.user", select: "name email avatar" },
    { path: "lastEditedBy", select: "name email avatar" },
  ]);

  return success({
    document: serializeDocument(document, user.id),
  });
}

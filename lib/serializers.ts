import { getUserRole } from "@/lib/permissions";

export function serializeUser(user: any) {
  if (!user) return null;

  return {
    id: user._id?.toString?.() ?? user.id?.toString?.(),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  };
}

export function serializeDocument(document: any, viewerId?: string) {
  const role = viewerId ? getUserRole(document, viewerId) ?? "VIEWER" : "VIEWER";

  return {
    id: document._id.toString(),
    title: document.title,
    content: document.content,
    owner: serializeUser(document.owner),
    role,
    collaborators: (document.collaborators ?? []).map((item: any) => ({
      user: serializeUser(item.user),
      role: item.role,
      invitedAt: item.invitedAt,
    })),
    lastEditedBy: serializeUser(document.lastEditedBy),
    lastSavedAt: document.lastSavedAt,
    revision: document.revision ?? 0,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function serializeVersion(version: any) {
  return {
    id: version._id.toString(),
    document: version.document?.toString?.() ?? version.document,
    title: version.title,
    content: version.content,
    label: version.label,
    createdBy: serializeUser(version.createdBy),
    createdAt: version.createdAt,
  };
}

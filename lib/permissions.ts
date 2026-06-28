import { Types } from "mongoose";
import Document from "@/models/Document";
import { connectDB } from "@/lib/mongodb";
import type { UserRole } from "@/types";

export function isValidObjectId(id: string) {
  return Types.ObjectId.isValid(id);
}

export function collaboratorQuery(userId: string) {
  return {
    $or: [
      { owner: userId },
      { "collaborators.user": userId },
    ],
  };
}

export async function getAccessibleDocument(documentId: string, userId: string) {
  if (!isValidObjectId(documentId)) {
    return null;
  }

  await connectDB();

  return Document.findOne({
    _id: documentId,
    ...collaboratorQuery(userId),
  });
}

function getEntityId(entity: unknown) {
  if (!entity) return "";

  if (typeof entity === "string") {
    return entity;
  }

  if (entity instanceof Types.ObjectId) {
    return entity.toString();
  }

  if (typeof entity === "object") {
    const record = entity as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };

    if (record._id) {
      return getEntityId(record._id);
    }

    if (record.id) {
      return getEntityId(record.id);
    }
  }

  return String(entity);
}

export function getUserRole(document: any, userId: string): UserRole | null {
  if (getEntityId(document.owner) === userId) {
    return "OWNER";
  }

  const collaborator = document.collaborators?.find(
    (item: any) => getEntityId(item.user) === userId
  );

  return collaborator?.role ?? null;
}

export function canEdit(role: UserRole | null) {
  return role === "OWNER" || role === "EDITOR";
}

export function canManage(role: UserRole | null) {
  return role === "OWNER";
}

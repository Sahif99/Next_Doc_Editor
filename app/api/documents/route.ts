import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/session";
import { error, success } from "@/lib/apiResponse";
import { connectDB } from "@/lib/mongodb";
import Document from "@/models/Document";
import Version from "@/models/Version";
import { CreateDocumentSchema } from "@/validators/document";
import { collaboratorQuery } from "@/lib/permissions";
import { serializeDocument } from "@/lib/serializers";
import { enforceRateLimit, normalizeDocumentInput, readLimitedJson } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, "documents:list", {
      windowMs: 60 * 1000,
      max: 120,
    });

    if (limited) return limited;

    const user = await requireApiUser();

    if (!user) return error("Unauthorized", 401);

    await connectDB();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const query: Record<string, unknown> = {
      ...collaboratorQuery(user.id),
    };

    if (q) {
      query.$and = [
        {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { content: { $regex: q, $options: "i" } },
          ],
        },
      ];
    }

    const documents = await Document.find(query)
      .populate("owner", "name email avatar")
      .populate("collaborators.user", "name email avatar")
      .populate("lastEditedBy", "name email avatar")
      .sort({ updatedAt: -1 });

    return success(documents.map((document) => serializeDocument(document, user.id)));
  } catch (err) {
    console.error("Failed to list documents", err);
    return error("Unable to load documents", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, "documents:create", {
      windowMs: 60 * 1000,
      max: 20,
    });

    if (limited) return limited;

    const user = await requireApiUser();

    if (!user) return error("Unauthorized", 401);

    const body = await readLimitedJson(request);
    const parsed = CreateDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return error(parsed.error.issues[0]?.message ?? "Invalid input", 422);
    }
    const normalized = normalizeDocumentInput(parsed.data);

    await connectDB();

    const document = await Document.create({
      title: normalized.title ?? parsed.data.title,
      content: normalized.content ?? "",
      owner: user.id,
      collaborators: [{ user: user.id, role: "OWNER" }],
      lastEditedBy: user.id,
      lastSavedAt: new Date(),
      revision: 1,
    });

    await Version.create({
      document: document._id,
      title: document.title,
      content: document.content || " ",
      createdBy: user.id,
      label: "Created document",
    });

    await document.populate([
      { path: "owner", select: "name email avatar" },
      { path: "collaborators.user", select: "name email avatar" },
      { path: "lastEditedBy", select: "name email avatar" },
    ]);

    return success(serializeDocument(document, user.id), 201);
  } catch (err) {
    if (err instanceof Error && err.message === "REQUEST_TOO_LARGE") {
      return error("Request body is too large", 413);
    }

    if (err instanceof Error && err.message === "INVALID_JSON") {
      return error("Invalid JSON body", 400);
    }

    console.error("Failed to create document", err);
    return error("Unable to create document", 500);
  }
}

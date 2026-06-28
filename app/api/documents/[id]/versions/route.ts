import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/session";
import { error, success } from "@/lib/apiResponse";
import { getAccessibleDocument } from "@/lib/permissions";
import Version from "@/models/Version";
import { serializeVersion } from "@/lib/serializers";
import { enforceRateLimit } from "@/lib/security";

export async function GET(request: NextRequest, context: RouteContext<"/api/documents/[id]/versions">) {
  const limited = enforceRateLimit(request, "documents:versions", {
    windowMs: 60 * 1000,
    max: 120,
  });

  if (limited) return limited;

  const user = await requireApiUser();

  if (!user) return error("Unauthorized", 401);

  const { id } = await context.params;
  const document = await getAccessibleDocument(id, user.id);

  if (!document) return error("Document not found", 404);

  const versions = await Version.find({ document: document._id })
    .populate("createdBy", "name email avatar")
    .sort({ createdAt: -1 })
    .limit(50);

  return success(versions.map(serializeVersion));
}

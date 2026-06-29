import Navbar from "@/components/Navbar";
import { DashboardClient } from "@/components/DashboardClient";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import Document from "@/models/Document";
import { collaboratorQuery } from "@/lib/permissions";
import { serializeDocument } from "@/lib/serializers";

export default async function DashboardPage() {
  const user = await requireUser();
  let documents: any[] = [];
  let offlineMode = false;

  try {
    await connectDB();

    documents = await Document.find(collaboratorQuery(user.id))
      .populate("owner", "name email avatar")
      .populate("collaborators.user", "name email avatar")
      .populate("lastEditedBy", "name email avatar")
      .sort({ updatedAt: -1 });
  } catch (err) {
    offlineMode = true;
    console.error("Dashboard using local offline data because the database is unavailable", err);
  }

  return (
    <>
      <Navbar />
      <main>
        <DashboardClient
          offlineMode={offlineMode}
          initialDocuments={documents.map((document) =>
            serializeDocument(document, user.id)
          )}
        />
      </main>
    </>
  );
}

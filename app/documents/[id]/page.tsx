import Navbar from "@/components/Navbar";
import { DocumentEditor } from "@/components/DocumentEditor";
import { OfflineDocumentEditor } from "@/components/OfflineDocumentEditor";
import { requireUser } from "@/lib/session";
import { getAccessibleDocument } from "@/lib/permissions";
import { serializeDocument } from "@/lib/serializers";
import { notFound } from "next/navigation";

export default async function DocumentPage(props: PageProps<"/documents/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  let document;

  try {
    document = await getAccessibleDocument(id, user.id);
  } catch (err) {
    console.error("Document using local offline data because the database is unavailable", err);

    return (
      <>
        <Navbar />
        <main>
          <OfflineDocumentEditor documentId={id} user={{ id: user.id, name: user.name || "User" }} />
        </main>
      </>
    );
  }

  if (!document && id.startsWith("offline-")) {
    return (
      <>
        <Navbar />
        <main>
          <OfflineDocumentEditor documentId={id} user={{ id: user.id, name: user.name || "User" }} />
        </main>
      </>
    );
  }

  if (!document) {
    notFound();
  }

  await document.populate([
    { path: "owner", select: "name email avatar" },
    { path: "collaborators.user", select: "name email avatar" },
    { path: "lastEditedBy", select: "name email avatar" },
  ]);

  return (
    <>
      <Navbar />
      <main>
        <DocumentEditor
          initialDocument={serializeDocument(document, user.id)}
          user={{ id: user.id, name: user.name || "User" }}
        />
      </main>
    </>
  );
}

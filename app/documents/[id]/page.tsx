import Navbar from "@/components/Navbar";
import { DocumentEditor } from "@/components/DocumentEditor";
import { requireUser } from "@/lib/session";
import { getAccessibleDocument } from "@/lib/permissions";
import { serializeDocument } from "@/lib/serializers";
import { notFound } from "next/navigation";

export default async function DocumentPage(props: PageProps<"/documents/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const document = await getAccessibleDocument(id, user.id);

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

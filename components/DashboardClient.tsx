"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { readApiResponse } from "@/lib/client-api";
import { htmlToPlainText } from "@/lib/text";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type DocCard = {
  id: string;
  title: string;
  content: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  updatedAt: string;
  lastSavedAt?: string;
};

export function DashboardClient({ initialDocuments }: { initialDocuments: DocCard[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredDocuments = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return documents;
    return documents.filter(
      (document) =>
        document.title.toLowerCase().includes(q) ||
        htmlToPlainText(document.content).toLowerCase().includes(q)
    );
  }, [documents, query]);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Untitled Document" }),
      });
      const payload = await readApiResponse<{ id: string }>(response);

      if (!response.ok) throw new Error(payload.message ?? "Unable to create document");
      if (!payload.data?.id) throw new Error("Document was created but no document id was returned");

      toast.success("Document created");
      router.push(`/documents/${payload.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create document");
    } finally {
      setCreating(false);
    }
  }

  async function deleteDocument(id: string) {
    setDeleteId(null);

    const previous = documents;
    setDocuments((items) => items.filter((item) => item.id !== id));

    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const payload = await readApiResponse<{ id: string }>(response);
      if (!response.ok) throw new Error(payload.message ?? "Unable to delete document");
      toast.success("Document deleted");
    } catch (error) {
      setDocuments(previous);
      toast.error(error instanceof Error ? error.message : "Unable to delete document");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete document?"
        description="This removes the document and its version history. This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteDocument(deleteId)}
      />

      <div className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Dashboard</p>
          <h1 className="mt-2 text-4xl font-black text-slate-950">Your documents</h1>
          <p className="mt-2 text-slate-600">Create, search, edit, invite, restore, and sync.</p>
        </div>

        <form onSubmit={createDocument} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="New document title"
            className="rounded-2xl border border-slate-300 px-4 py-3"
          />
          <button
            disabled={creating}
            className="rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search documents..."
        className="mt-6 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
      />

      {filteredDocuments.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-2xl font-black text-slate-950">No documents yet</h2>
          <p className="mt-2 text-slate-600">Create your first document and the page stops looking lonely.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((document) => (
            <article key={document.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {document.role}
                  </span>
                  <h2 className="mt-4 line-clamp-2 text-xl font-black text-slate-950">
                    {document.title}
                  </h2>
                </div>
                {document.role === "OWNER" && (
                  <button
                    onClick={() => setDeleteId(document.id)}
                    className="rounded-full px-3 py-1 text-sm font-bold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-4 line-clamp-3 text-sm text-slate-600">
                {htmlToPlainText(document.content) || "No content yet."}
              </p>
              <Link
                href={`/documents/${document.id}`}
                className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
              >
                Open editor
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

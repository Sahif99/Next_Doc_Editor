"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { readApiResponse } from "@/lib/client-api";
import { htmlToPlainText } from "@/lib/text";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { offlineDB, type OfflineQueueItem } from "@/lib/offline-db";

type DocCard = {
  id: string;
  title: string;
  content: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  updatedAt: string;
  lastSavedAt?: string;
  offline?: boolean;
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

  const queueOfflineCreate = useCallback(async (nextTitle: string) => {
    const now = new Date().toISOString();
    const tempId = `offline-${crypto.randomUUID()}`;
    const document: DocCard = {
      id: tempId,
      title: nextTitle,
      content: "",
      role: "OWNER",
      updatedAt: now,
      lastSavedAt: now,
      offline: true,
    };

    await offlineDB.documents.put({
      id: tempId,
      title: nextTitle,
      content: "",
      role: "OWNER",
      revision: 0,
      updatedAt: now,
    });

    await offlineDB.queue.add({
      operation: "create",
      operationId: crypto.randomUUID(),
      documentId: tempId,
      title: nextTitle,
      content: "",
      baseTitle: nextTitle,
      baseContent: "",
      baseRevision: 0,
      createdAt: now,
      nextAttemptAt: now,
      attempts: 0,
      status: "pending",
      lastError: "offline-create",
    });

    setDocuments((items) => [document, ...items]);
    setTitle("");
    toast.success("Document queued and will sync when online");
  }, []);

  const syncOfflineCreates = useCallback(async () => {
    if (!navigator.onLine) return;

    const queued = (await offlineDB.queue.toArray()).filter(
      (item) => item.operation === "create" && item.status !== "conflict"
    );

    for (const item of queued) {
      if (!item.id || new Date(item.nextAttemptAt).getTime() > Date.now()) {
        continue;
      }

      await offlineDB.queue.update(item.id, { status: "syncing" });

      try {
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: item.title }),
        });
        const payload = await readApiResponse<DocCard>(response);

        if (!response.ok || !payload.data?.id) {
          throw new Error(payload.message ?? "Unable to sync queued document");
        }

        await offlineDB.documents.delete(item.documentId);
        await offlineDB.documents.put({
          id: payload.data.id,
          title: payload.data.title,
          content: payload.data.content ?? "",
          role: payload.data.role,
          revision: 1,
          updatedAt: new Date().toISOString(),
        });
        await offlineDB.queue.delete(item.id);

        setDocuments((items) =>
          items.map((document) =>
            document.id === item.documentId ? { ...payload.data!, offline: false } : document
          )
        );
        toast.success(`Synced "${item.title}"`);
      } catch (error) {
        const attempts = item.attempts + 1;
        const delay = Math.min(60_000, 2 ** attempts * 1000);

        await offlineDB.queue.update(item.id, {
          attempts,
          status: "pending",
          nextAttemptAt: new Date(Date.now() + delay).toISOString(),
          lastError: error instanceof Error ? error.message : "Create sync failed",
        });
      }
    }
  }, []);

  useEffect(() => {
    async function loadOfflineCreates() {
      const queuedCreates = (await offlineDB.queue.toArray()).filter(
        (item): item is OfflineQueueItem & { id: number } =>
          item.operation === "create" && Boolean(item.id)
      );

      if (queuedCreates.length === 0) return;

      const offlineDocuments = await Promise.all(
        queuedCreates.map(async (item) => {
          const cached = await offlineDB.documents.get(item.documentId);
          return {
            id: item.documentId,
            title: cached?.title ?? item.title,
            content: cached?.content ?? "",
            role: cached?.role ?? "OWNER",
            updatedAt: cached?.updatedAt ?? item.createdAt,
            lastSavedAt: cached?.updatedAt ?? item.createdAt,
            offline: true,
          } satisfies DocCard;
        })
      );

      setDocuments((items) => {
        const existingIds = new Set(items.map((item) => item.id));
        return [
          ...offlineDocuments.filter((document) => !existingIds.has(document.id)),
          ...items,
        ];
      });
    }

    loadOfflineCreates();
    syncOfflineCreates();

    window.addEventListener("online", syncOfflineCreates);
    return () => window.removeEventListener("online", syncOfflineCreates);
  }, [syncOfflineCreates]);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const nextTitle = title.trim() || "Untitled Document";

    try {
      if (!navigator.onLine) {
        await queueOfflineCreate(nextTitle);
        return;
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      const payload = await readApiResponse<{ id: string }>(response);

      if (!response.ok) {
        if (response.status >= 500) {
          await queueOfflineCreate(nextTitle);
          return;
        }

        throw new Error(payload.message ?? "Unable to create document");
      }

      if (!payload.data?.id) throw new Error("Document was created but no document id was returned");

      toast.success("Document created");
      router.push(`/documents/${payload.data.id}`);
    } catch (error) {
      if (error instanceof TypeError) {
        await queueOfflineCreate(nextTitle);
        return;
      }

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
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${document.offline ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                    {document.offline ? "QUEUED" : document.role}
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
              {document.offline ? (
                <button
                  type="button"
                  disabled
                  className="mt-5 inline-flex rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500"
                >
                  Waiting to sync
                </button>
              ) : (
                <Link
                  href={`/documents/${document.id}`}
                  className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                >
                  Open editor
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

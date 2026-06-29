"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { offlineDB, type OfflineDocument } from "@/lib/offline-db";
import { DocumentEditor } from "@/components/DocumentEditor";

export function OfflineDocumentEditor({
  documentId,
  user,
}: {
  documentId: string;
  user: { id: string; name: string };
}) {
  const [document, setDocument] = useState<OfflineDocument | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    offlineDB.documents.get(documentId).then((cached) => {
      setDocument(cached ?? null);
      setLoaded(true);
    });
  }, [documentId]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-slate-600">
        Loading local copy...
      </div>
    );
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-black text-slate-950">No local copy found</h1>
        <p className="mt-3 text-slate-600">
          This document has not been opened on this device yet, so it cannot be loaded offline.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 font-bold text-white">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <DocumentEditor
      initialDocument={{
        id: document.id,
        title: document.title,
        content: document.content,
        role: document.role ?? "EDITOR",
        collaborators: [],
        revision: document.revision ?? 0,
      }}
      user={user}
    />
  );
}

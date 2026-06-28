"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { readApiResponse } from "@/lib/client-api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Version = {
  id: string;
  title: string;
  content: string;
  label: string;
  createdAt: string;
  createdBy?: { name?: string };
};

export function VersionHistory({
  documentId,
  canEdit,
  onRestore,
}: {
  documentId: string;
  canEdit: boolean;
  onRestore: (document: any) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/versions`);
      const payload = await readApiResponse<Version[]>(response);
      if (!response.ok) throw new Error(payload.message ?? "Unable to load versions");
      setVersions(payload.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load versions");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  async function restore(versionId: string) {
    setRestoreId(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.message ?? "Unable to restore");
      onRestore(payload.data);
      toast.success("Version restored");
      loadVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to restore");
    }
  }

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <ConfirmDialog
        open={Boolean(restoreId)}
        title="Restore this version?"
        description="Your current content will be saved into version history before this older version is restored."
        confirmLabel="Restore"
        onCancel={() => setRestoreId(null)}
        onConfirm={() => restoreId && restore(restoreId)}
      />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950">Version history</h2>
        <button onClick={loadVersions} className="text-sm font-bold text-blue-600">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading versions...</p>
      ) : versions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No versions yet.</p>
      ) : (
        <div className="mt-4 max-h-80 space-y-3 overflow-auto">
          {versions.map((version) => (
            <div key={version.id} className="rounded-2xl bg-slate-50 p-3">
              <p className="font-bold text-slate-900">{version.label}</p>
              <p className="text-xs text-slate-500">
                {new Date(version.createdAt).toLocaleString()} by {version.createdBy?.name ?? "Unknown"}
              </p>
              {canEdit && (
                <button
                  onClick={() => setRestoreId(version.id)}
                  className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-800"
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { readApiResponse } from "@/lib/client-api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Collaborator = {
  user: { id: string; name: string; email: string; avatar?: string };
  role: "OWNER" | "EDITOR" | "VIEWER";
};

export function CollaboratorsPanel({
  documentId,
  role,
  collaborators,
  onUpdate,
}: {
  documentId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  collaborators: Collaborator[];
  onUpdate: (collaborators: Collaborator[]) => void;
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [loading, setLoading] = useState(false);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const canInvite = role === "OWNER";

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const payload = await readApiResponse<{
        document: { collaborators: Collaborator[] };
        email: { sent: boolean; skipped: boolean };
      }>(response);

      if (!response.ok) throw new Error(payload.message ?? "Unable to invite");
      if (!payload.data?.document) throw new Error("Invite succeeded but no collaborator list was returned");

      onUpdate(payload.data.document.collaborators);
      setEmail("");
      toast.success(
        payload.data.email.sent
          ? "Collaborator invited and email sent"
          : "Collaborator added. Configure SMTP to send real emails."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite");
    } finally {
      setLoading(false);
    }
  }

  async function removeCollaborator(userId: string) {
    setRemoveUserId(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload = await readApiResponse<{
        document: { collaborators: Collaborator[] };
      }>(response);

      if (!response.ok) throw new Error(payload.message ?? "Unable to remove collaborator");
      if (!payload.data?.document) throw new Error("Collaborator removed but no updated list was returned");

      onUpdate(payload.data.document.collaborators);
      toast.success("Collaborator removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove collaborator");
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <ConfirmDialog
        open={Boolean(removeUserId)}
        title="Remove collaborator?"
        description="This user will lose access to the document immediately."
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setRemoveUserId(null)}
        onConfirm={() => removeUserId && removeCollaborator(removeUserId)}
      />

      <h2 className="text-lg font-black text-slate-950">Collaborators</h2>
      <div className="mt-4 space-y-3">
        {collaborators.map((item) => (
          <div key={item.user.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
            <div>
              <p className="font-bold text-slate-900">{item.user.name}</p>
              <p className="text-xs text-slate-500">{item.user.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                {item.role}
              </span>
              {canInvite && item.role !== "OWNER" && (
                <button
                  type="button"
                  onClick={() => setRemoveUserId(item.user.id)}
                  className="rounded-full px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canInvite ? (
        <form onSubmit={invite} className="mt-5 space-y-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="teammate@example.com"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3"
          />
          <div className="flex gap-2">
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as "EDITOR" | "VIEWER")}
              className="flex-1 rounded-2xl border border-slate-300 px-4 py-3"
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button
              disabled={loading}
              className="rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-60"
            >
              Invite
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Only the owner can invite collaborators.</p>
      )}
    </section>
  );
}

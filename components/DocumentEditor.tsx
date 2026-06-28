"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useSocket } from "@/hooks/useSocket";
import { offlineDB } from "@/lib/offline-db";
import { CollaboratorsPanel } from "@/components/CollaboratorsPanel";
import { VersionHistory } from "@/components/VersionHistory";
import { readApiResponse } from "@/lib/client-api";
import { EditorTools, type EditorTool } from "@/components/EditorTools";
import { mergeDocumentContent } from "@/lib/conflicts";

type DocumentPayload = {
  id: string;
  title: string;
  content: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  collaborators: any[];
  lastSavedAt?: string;
  revision: number;
};

type ConflictPayload = {
  serverDocument: DocumentPayload;
  clientDocument: {
    title: string;
    content: string;
    baseRevision: number;
    baseTitle?: string;
    baseContent?: string;
  };
};

export function DocumentEditor({
  initialDocument,
  user,
}: {
  initialDocument: DocumentPayload;
  user: { id: string; name: string };
}) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const linkRangeRef = useRef<Range | null>(null);
  const [document, setDocument] = useState(initialDocument);
  const [title, setTitle] = useState(initialDocument.title);
  const [content, setContent] = useState(initialDocument.content);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "queued" | "error">("saved");
  const [online, setOnline] = useState(true);
  const [syncDetail, setSyncDetail] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [activeTools, setActiveTools] = useState<EditorTool[]>([]);
  const [conflict, setConflict] = useState<ConflictPayload | null>(null);
  const [presence, setPresence] = useState<Array<{ id: string; name: string }>>([]);

  const canEdit = document.role === "OWNER" || document.role === "EDITOR";
  const socket = useSocket(document.id, user);

  const statusLabel = useMemo(() => {
    if (!online) return "Offline — changes queued";
    if (syncDetail) return syncDetail;
    if (saveStatus === "saving") return "Saving...";
    if (saveStatus === "queued") return "Queued for sync";
    if (saveStatus === "error") return "Save failed";
    return socket.connected ? "Saved • realtime connected" : "Saved";
  }, [online, saveStatus, socket.connected, syncDetail]);

  const cacheDocument = useCallback(
    async (nextTitle: string, nextContent: string, revision = document.revision) => {
      await offlineDB.documents.put({
        id: document.id,
        title: nextTitle,
        content: nextContent,
        role: document.role,
        revision,
        updatedAt: new Date().toISOString(),
      });
    },
    [document.id, document.revision, document.role]
  );

  const enqueueSave = useCallback(
    async (nextTitle: string, nextContent: string, reason = "offline") => {
      const now = new Date().toISOString();

      await offlineDB.queue.add({
        operationId: crypto.randomUUID(),
        documentId: document.id,
        title: nextTitle,
        content: nextContent,
        baseTitle: document.title,
        baseContent: document.content,
        baseRevision: document.revision ?? 0,
        createdAt: now,
        nextAttemptAt: now,
        attempts: 0,
        status: "pending",
        lastError: reason,
      });

      setSaveStatus("queued");
      setSyncDetail("Queued for sync");
    },
    [document.content, document.id, document.revision, document.title]
  );

  const saveNow = useCallback(
    async (
      nextTitle: string,
      nextContent: string,
      createVersion = false,
      options: { force?: boolean; baseRevision?: number } = {}
    ) => {
      if (!canEdit) return false;

      await cacheDocument(nextTitle, nextContent);

      if (!navigator.onLine) {
        await enqueueSave(nextTitle, nextContent);
        return true;
      }

      setSaveStatus("saving");

      try {
        const response = await fetch(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: nextTitle,
            content: nextContent,
            createVersion,
            baseRevision: options.baseRevision ?? document.revision ?? 0,
            baseTitle: document.title,
            baseContent: document.content,
            force: options.force ?? false,
          }),
        });
        const payload = await readApiResponse<DocumentPayload>(response);

        if (response.status === 409) {
          setConflict(payload as unknown as ConflictPayload);
          setSaveStatus("error");
          toast.error("Conflict detected. Choose how to resolve it.");
          return false;
        }

        if (!response.ok) throw new Error(payload.message ?? "Unable to save");
        if (!payload.data) throw new Error("Save succeeded but no document was returned");

        setDocument(payload.data);
        await cacheDocument(payload.data.title, payload.data.content, payload.data.revision);
        setConflict(null);
        setSaveStatus("saved");
        setSyncDetail("");
        socket.emitUpdate({
          title: nextTitle,
          content: nextContent,
          revision: payload.data.revision,
          user,
        });
        return true;
      } catch (error) {
        if (!navigator.onLine || error instanceof TypeError) {
          await enqueueSave(nextTitle, nextContent, "network");
          return true;
        }

        setSaveStatus("error");
        toast.error(error instanceof Error ? error.message : "Unable to save");
        return false;
      }
    },
    [
      cacheDocument,
      canEdit,
      document.content,
      document.id,
      document.revision,
      document.title,
      enqueueSave,
      socket,
      user,
    ]
  );

  const debouncedSave = useDebouncedCallback(saveNow, 900);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    const queued = (await offlineDB.queue.where({ documentId: document.id }).sortBy("createdAt"))
      .filter((item) => item.status !== "conflict");

    if (queued.length === 0) return;

    setSaveStatus("saving");

    for (const item of queued) {
      const now = Date.now();

      if (new Date(item.nextAttemptAt).getTime() > now) {
        continue;
      }

      await offlineDB.queue.update(item.id!, {
        status: "syncing",
      });
      setSyncDetail(`Syncing offline change ${queued.indexOf(item) + 1}/${queued.length}`);

      try {
        const response = await fetch(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            content: item.content,
            createVersion: true,
            baseRevision: item.baseRevision,
            baseTitle: item.baseTitle,
            baseContent: item.baseContent,
          }),
        });
        const payload = (await readApiResponse<any>(response)) as any;

        if (response.status === 409) {
          const mergedContent = mergeDocumentContent(
            payload.serverDocument.content,
            item.content,
            item.baseContent
          );
          const mergeResponse = await fetch(`/api/documents/${document.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: payload.serverDocument.title,
              content: mergedContent,
              createVersion: true,
              baseRevision: payload.serverDocument.revision,
              baseTitle: payload.serverDocument.title,
              baseContent: payload.serverDocument.content,
              force: true,
            }),
          });
          const mergePayload = await readApiResponse<DocumentPayload>(mergeResponse);

          if (!mergeResponse.ok || !mergePayload.data) {
            throw new Error(mergePayload.message ?? "Unable to merge queued change");
          }

          setDocument(mergePayload.data);
          setTitle(mergePayload.data.title);
          setContent(mergePayload.data.content);
          if (editorRef.current) editorRef.current.innerHTML = mergePayload.data.content;
          await cacheDocument(
            mergePayload.data.title,
            mergePayload.data.content,
            mergePayload.data.revision
          );
          await offlineDB.queue.delete(item.id!);
          continue;
        }

        if (!response.ok || !payload.data) {
          throw new Error(payload.message ?? "Unable to sync queued change");
        }

        setDocument(payload.data);
        setTitle(payload.data.title);
        setContent(payload.data.content);
        if (editorRef.current) editorRef.current.innerHTML = payload.data.content;
        await cacheDocument(payload.data.title, payload.data.content, payload.data.revision);
        await offlineDB.queue.delete(item.id!);
      } catch (error) {
        const attempts = item.attempts + 1;
        const delay = Math.min(60_000, 2 ** attempts * 1000);

        await offlineDB.queue.update(item.id!, {
          attempts,
          status: attempts >= 5 ? "failed" : "pending",
          nextAttemptAt: new Date(Date.now() + delay).toISOString(),
          lastError: error instanceof Error ? error.message : "Sync failed",
        });

        setSaveStatus("queued");
        setSyncDetail(`Sync delayed; retrying in ${Math.round(delay / 1000)}s`);
        return;
      }
    }

    const remaining = await offlineDB.queue.where({ documentId: document.id }).count();

    if (remaining === 0) {
      setSaveStatus("saved");
      setSyncDetail("");
      toast.success("Offline changes synced");
    }
  }, [cacheDocument, document.id]);

  useEffect(() => {
    cacheDocument(title, content);
  }, [cacheDocument, content, title]);

  useEffect(() => {
    setOnline(navigator.onLine);
    syncQueue();

    function onOnline() {
      setOnline(true);
      syncQueue();
    }

    function onOffline() {
      setOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [document.id, syncQueue]);

  useEffect(() => {
    function handleSelectionChange() {
      refreshActiveTools();
    }

    window.document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      window.document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialDocument.content;
    }
  }, [initialDocument.id, initialDocument.content]);

  useEffect(() => {
    const cleanup = socket.onUpdate((payload) => {
      if (payload?.user?.id === user.id) return;
      if (typeof payload?.title === "string") setTitle(payload.title);
      if (typeof payload?.content === "string") {
        setContent(payload.content);
        if (editorRef.current) {
          editorRef.current.innerHTML = payload.content;
        }
      }
      if (typeof payload?.revision === "number") {
        setDocument((current) => ({ ...current, revision: payload.revision }));
      }
      toast(`${payload?.user?.name ?? "A collaborator"} updated the document`);
    });

    const cleanupPresenceJoin = socket.onPresenceJoin((joinedUser) => {
      if (!joinedUser?.id || joinedUser.id === user.id) return;
      setPresence((current) => {
        if (current.some((item) => item.id === joinedUser.id)) return current;
        return [...current, joinedUser];
      });
    });

    const cleanupPresenceLeave = socket.onPresenceLeave((leftUser) => {
      if (!leftUser?.id) return;
      setPresence((current) => current.filter((item) => item.id !== leftUser.id));
    });

    const cleanupPresenceList = socket.onPresenceList((users) => {
      setPresence(Array.isArray(users) ? users : []);
    });

    return () => {
      cleanup();
      cleanupPresenceJoin();
      cleanupPresenceLeave();
      cleanupPresenceList();
    };
  }, [socket, user.id]);

  function updateTitle(value: string) {
    setTitle(value);
    debouncedSave(value, editorRef.current?.innerHTML ?? content);
  }

  function syncRichEditor(createVersion = false) {
    const nextValue = editorRef.current?.innerHTML ?? "";
    setContent(nextValue);
    refreshActiveTools();
    socket.emitUpdate({
      title,
      content: nextValue,
      revision: document.revision,
      user,
      live: true,
    });

    if (createVersion) {
      saveNow(title, nextValue, true);
    } else {
      debouncedSave(title, nextValue);
    }
  }

  function applyTool(tool: EditorTool) {
    if (!canEdit) return;

    editorRef.current?.focus();

    if (tool === "bold") window.document.execCommand("bold");
    if (tool === "italic") window.document.execCommand("italic");
    if (tool === "heading") window.document.execCommand("formatBlock", false, "h2");
    if (tool === "quote") window.document.execCommand("formatBlock", false, "blockquote");
    if (tool === "bullet") window.document.execCommand("insertUnorderedList");
    if (tool === "numbered") window.document.execCommand("insertOrderedList");
    if (tool === "code") window.document.execCommand("formatBlock", false, "pre");

    if (tool === "link") {
      const selection = window.getSelection();

      if (selection && selection.rangeCount > 0) {
        linkRangeRef.current = selection.getRangeAt(0).cloneRange();
      }

      setLinkUrl("");
      setLinkDialogOpen(true);
      return;
    }

    syncRichEditor(false);
    refreshActiveTools();
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUrl = linkUrl.trim();

    if (!trimmedUrl) return;

    try {
      const parsedUrl = new URL(trimmedUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        toast.error("Use an http or https link");
        return;
      }

      editorRef.current?.focus();

      const selection = window.getSelection();

      if (selection && linkRangeRef.current) {
        selection.removeAllRanges();
        selection.addRange(linkRangeRef.current);
      }

      window.document.execCommand("createLink", false, parsedUrl.toString());
      linkRangeRef.current = null;
      setLinkDialogOpen(false);
      setLinkUrl("");
      syncRichEditor(false);
      refreshActiveTools();
    } catch {
      toast.error("Enter a valid link");
    }
  }

  function refreshActiveTools() {
    const root = editorRef.current;
    const selection = window.getSelection();

    if (!root || !selection || selection.rangeCount === 0) {
      setActiveTools([]);
      return;
    }

    const anchorNode = selection.anchorNode;

    if (anchorNode && !root.contains(anchorNode)) {
      setActiveTools([]);
      return;
    }

    const nextActive: EditorTool[] = [];

    if (window.document.queryCommandState("bold")) nextActive.push("bold");
    if (window.document.queryCommandState("italic")) nextActive.push("italic");
    if (window.document.queryCommandState("insertUnorderedList")) nextActive.push("bullet");
    if (window.document.queryCommandState("insertOrderedList")) nextActive.push("numbered");

    let current: Node | null = anchorNode;

    while (current && current !== root) {
      if (current instanceof HTMLElement) {
        const tag = current.tagName.toLowerCase();
        if (tag === "h1" || tag === "h2") nextActive.push("heading");
        if (tag === "blockquote") nextActive.push("quote");
        if (tag === "pre" || tag === "code") nextActive.push("code");
        if (tag === "a") nextActive.push("link");
      }
      current = current.parentNode;
    }

    setActiveTools([...new Set(nextActive)]);
  }

  function replaceAll(find: string, replace: string) {
    const root = editorRef.current;
    if (!canEdit || !find || !root) return;

    const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    let changed = false;

    textNodes.forEach((node) => {
      if (node.nodeValue?.includes(find)) {
        node.nodeValue = node.nodeValue.split(find).join(replace);
        changed = true;
      }
    });

    if (!changed) {
      toast("No matches found");
      return;
    }

    const nextValue = root.innerHTML;
    setContent(nextValue);
    saveNow(title, nextValue, true);
    toast.success("Text replaced");
  }

  async function manualSave() {
    const nextValue = editorRef.current?.innerHTML ?? content;
    const saved = await saveNow(title, nextValue, true);

    if (saved) {
      toast.success("Document saved");
      router.push("/dashboard");
    }
  }

  function useServerVersion() {
    if (!conflict) return;

    setDocument(conflict.serverDocument);
    setTitle(conflict.serverDocument.title);
    setContent(conflict.serverDocument.content);

    if (editorRef.current) {
      editorRef.current.innerHTML = conflict.serverDocument.content;
    }

    setConflict(null);
    setSaveStatus("saved");
  }

  async function overwriteServerVersion() {
    if (!conflict) return;

    const saved = await saveNow(
      conflict.clientDocument.title,
      conflict.clientDocument.content,
      true,
      {
        force: true,
        baseRevision: conflict.serverDocument.revision,
      }
    );

    if (saved) {
      toast.success("Conflict resolved by overwriting server version");
    }
  }

  async function mergeConflict() {
    if (!conflict) return;

    const mergedContent = mergeDocumentContent(
      conflict.serverDocument.content,
      conflict.clientDocument.content,
      conflict.clientDocument.baseContent ?? ""
    );
    setTitle(conflict.serverDocument.title);
    setContent(mergedContent);

    if (editorRef.current) {
      editorRef.current.innerHTML = mergedContent;
    }

    const saved = await saveNow(conflict.serverDocument.title, mergedContent, true, {
      force: true,
      baseRevision: conflict.serverDocument.revision,
    });

    if (saved) {
      toast.success("Conflict merged");
    }
  }

  function applyDocument(nextDocument: DocumentPayload) {
    setDocument(nextDocument);
    setTitle(nextDocument.title);
    setContent(nextDocument.content);
    if (editorRef.current) {
      editorRef.current.innerHTML = nextDocument.content;
    }
    router.refresh();
  }

  return (
    <>
      {linkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <form
            onSubmit={submitLink}
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-dialog-title"
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
          >
            <h2 id="link-dialog-title" className="text-xl font-black text-slate-950">
              Add link
            </h2>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">URL</span>
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                autoFocus
                type="url"
                placeholder="https://example.com"
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  linkRangeRef.current = null;
                  setLinkDialogOpen(false);
                  setLinkUrl("");
                }}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                Add link
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(event) => updateTitle(event.target.value)}
              disabled={!canEdit}
              className="w-full rounded-2xl border border-transparent px-3 py-2 text-3xl font-black text-slate-950 hover:border-slate-200 disabled:bg-white disabled:text-slate-700"
            />
            <p className="px-3 text-sm text-slate-500">{statusLabel}</p>
            {presence.length > 0 && (
              <p className="px-3 text-xs font-semibold text-blue-600">
                Editing now: {presence.map((item) => item.name).join(", ")}
              </p>
            )}
          </div>
          <button
            onClick={manualSave}
            disabled={!canEdit}
            className="rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            Manual save
          </button>
        </div>

        {conflict && (
          <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="font-black text-amber-900">Conflict detected</h2>
            <p className="mt-1 text-sm text-amber-800">
              Someone else saved this document before your save finished. Choose one version.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={useServerVersion}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-amber-900"
              >
                Keep server version
              </button>
              <button
                onClick={overwriteServerVersion}
                className="rounded-2xl bg-amber-700 px-4 py-2 text-sm font-bold text-white"
              >
                Overwrite with mine
              </button>
              <button
                onClick={mergeConflict}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
              >
                Merge both
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <EditorTools
            content={content}
            canEdit={canEdit}
            activeTools={activeTools}
            onTool={applyTool}
            onReplaceAll={replaceAll}
          />
        </div>

        <div
          ref={editorRef}
          contentEditable={canEdit}
          suppressContentEditableWarning
          onInput={() => syncRichEditor(false)}
          onClick={refreshActiveTools}
          onKeyUp={refreshActiveTools}
          onMouseUp={refreshActiveTools}
          className="rich-editor mt-5 min-h-[65vh] w-full rounded-3xl border border-slate-100 bg-white p-6 text-lg leading-8 text-slate-800 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
          data-placeholder="Start typing your document..."
        />
      </section>

      <aside className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Permission</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{document.role}</p>
          {!canEdit && <p className="mt-2 text-sm text-slate-500">Viewer mode: editing is disabled.</p>}
        </div>

        <CollaboratorsPanel
          documentId={document.id}
          role={document.role}
          collaborators={document.collaborators}
          onUpdate={(collaborators) => setDocument((current) => ({ ...current, collaborators }))}
        />

        <VersionHistory
          documentId={document.id}
          canEdit={canEdit}
          onRestore={applyDocument}
        />
      </aside>
      </div>
    </>
  );
}

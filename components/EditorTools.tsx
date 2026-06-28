"use client";

import { FormEvent, useMemo, useState } from "react";
import { htmlToPlainText } from "@/lib/text";

export type EditorTool =
  | "bold"
  | "italic"
  | "heading"
  | "quote"
  | "bullet"
  | "numbered"
  | "code"
  | "link";

export function EditorTools({
  content,
  canEdit,
  activeTools,
  onTool,
  onReplaceAll,
}: {
  content: string;
  canEdit: boolean;
  activeTools: EditorTool[];
  onTool: (tool: EditorTool) => void;
  onReplaceAll: (find: string, replace: string) => void;
}) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const stats = useMemo(() => {
    const plainText = htmlToPlainText(content);
    const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    const characters = plainText.length;
    const readingMinutes = Math.max(1, Math.ceil(words / 220));

    return { words, characters, readingMinutes };
  }, [content]);

  function replaceMatches(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!find) return;
    onReplaceAll(find, replace);
    setFind("");
    setReplace("");
  }

  const tools: Array<{ id: EditorTool; label: string }> = [
    { id: "bold", label: "Bold" },
    { id: "italic", label: "Italic" },
    { id: "heading", label: "H2" },
    { id: "quote", label: "Quote" },
    { id: "bullet", label: "Bullet" },
    { id: "numbered", label: "Numbered" },
    { id: "code", label: "Code" },
    { id: "link", label: "Link" },
  ];

  return (
    <section className="sticky top-[84px] z-20 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">Editor tools</h2>
          <p className="text-xs text-slate-500">Visible rich-text controls — no markdown symbols.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              disabled={!canEdit}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onTool(tool.id)}
              className={
                activeTools.includes(tool.id)
                  ? "rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 disabled:opacity-50"
                  : "rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 disabled:opacity-50"
              }
              aria-pressed={activeTools.includes(tool.id)}
            >
              {tool.label}
            </button>
          ))}
          <button
            onClick={() => setPreviewOpen((value) => !value)}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
          >
            {previewOpen ? "Hide preview" : "Preview"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
        <div>
          <p className="text-lg font-black text-slate-950">{stats.words}</p>
          <p className="text-xs text-slate-500">words</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-950">{stats.characters}</p>
          <p className="text-xs text-slate-500">chars</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-950">{stats.readingMinutes}</p>
          <p className="text-xs text-slate-500">min read</p>
        </div>
      </div>

      <form onSubmit={replaceMatches} className="mt-3 flex flex-col gap-2 md:flex-row">
        <input
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder="Find text"
          className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-2"
        />
        <input
          value={replace}
          onChange={(event) => setReplace(event.target.value)}
          placeholder="Replace with"
          className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-2"
        />
        <button
          disabled={!canEdit || !find}
          className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Replace
        </button>
      </form>

      {previewOpen && (
        <div className="mt-4 max-h-80 overflow-auto rounded-2xl bg-slate-50 p-4">
          {content ? (
            <div
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <p className="text-sm text-slate-500">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

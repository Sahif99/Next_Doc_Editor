import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-73px)] overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_35%),linear-gradient(135deg,#ffffff,#f8fafc)]">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Local-first • Realtime • Free editor tools
          </span>

          <h1 className="mt-8 max-w-4xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
            Write together, even when the internet gets weird.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Next Docs is a collaborative document editor with authenticated workspaces,
            autosave, offline drafts, version history, collaborators, and local writing tools.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-slate-800">
              Start writing
            </Link>
            <Link href="/login" className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-500">
              Login
            </Link>
          </div>

          <div className="mt-16 grid w-full gap-4 md:grid-cols-4">
            {["Document CRUD", "Live collaboration", "Offline sync", "Version restore"].map((item) => (
              <div key={item} className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Built in</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">{item}</h2>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

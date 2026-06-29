import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function OfflinePage() {
  return (
    <>
      <Navbar />
      <main className="bg-slate-50 px-6 py-16">
        <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Offline</p>
          <h1 className="mt-3 text-4xl font-black text-slate-950">You are working from this device.</h1>
          <p className="mt-4 leading-7 text-slate-600">
            Cached pages and saved document drafts are still available. Open a document that
            was loaded on this device, keep editing, and queued changes will sync when the
            connection comes back.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-full bg-slate-950 px-5 py-3 font-bold text-white">
              Open dashboard
            </Link>
            <Link href="/" className="rounded-full border border-slate-300 bg-white px-5 py-3 font-bold text-slate-900">
              Home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

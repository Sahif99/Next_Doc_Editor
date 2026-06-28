import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-4xl font-black text-slate-950">Document not found</h1>
          <p className="mt-3 text-slate-600">It may have been deleted or you may not have access.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 font-bold text-white">
            Back to dashboard
          </Link>
        </div>
      </main>
    </>
  );
}

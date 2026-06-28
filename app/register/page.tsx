import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import Navbar from "@/components/Navbar";

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 py-12">
        <Suspense>
          <AuthForm mode="register" />
        </Suspense>
      </main>
    </>
  );
}

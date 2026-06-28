"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      if (isRegister) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(formData.get("name") ?? ""),
            email,
            password,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message ?? "Unable to register");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid email or password");
      }

      toast.success(isRegister ? "Account created" : "Welcome back");
      router.push(searchParams.get("callbackUrl") || "/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          {isRegister ? "Create account" : "Login"}
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          {isRegister ? "Start your workspace" : "Welcome back"}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {isRegister && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input
              name="name"
              required
              minLength={2}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Ada Lovelace"
            />
          </label>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            name="email"
            required
            type="email"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <div className="relative mt-2">
            <input
              name="password"
              required
              type={showPassword ? "text" : "password"}
              minLength={isRegister ? 8 : 1}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12"
              placeholder={isRegister ? "8+ chars with letters and numbers" : "Password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <span
                aria-hidden
                className="relative block h-4 w-6 rounded-[999px] border-2 border-current before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-current"
              />
              {showPassword && (
                <span
                  aria-hidden
                  className="absolute h-5 w-0.5 rotate-45 rounded-full bg-current"
                />
              )}
            </button>
          </div>
        </label>

        <button
          disabled={loading}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Please wait..." : isRegister ? "Create account" : "Login"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {isRegister ? "Already have an account?" : "New here?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-bold text-blue-600 hover:text-blue-700"
        >
          {isRegister ? "Login" : "Register"}
        </Link>
      </p>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { loginThunk, meThunk } from "@/redux/slices/authSlice";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("Admin@123");

  useEffect(() => {
    if (auth.status === "authenticated") router.replace("/dashboard");
  }, [auth.status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await dispatch(loginThunk({ email, password }));
    if (res.meta.requestStatus === "fulfilled") {
      await dispatch(meThunk());
      router.replace("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-zinc-600">Sign in with your RBAC account.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="••••••••"
            />
          </div>

          {auth.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {auth.error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={auth.status === "loading"}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {auth.status === "loading" ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
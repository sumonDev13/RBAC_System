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
  const [password, setPassword] = useState("Admin@1234");

  useEffect(() => {
    if (auth.status === "authenticated") router.replace("/dashboard");
  }, [auth.status, router]);

  // Handle Google OAuth errors redirected back from backend
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      // You could dispatch an error action here if your slice supports it
      console.error("Google OAuth error:", error);
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await dispatch(loginThunk({ email, password }));
    if (res.meta.requestStatus === "fulfilled") {
      await dispatch(meThunk());
      router.replace("/dashboard");
    }
  }

  function handleGoogleLogin() {
    // Full page redirect to backend — Google OAuth doesn't support fetch/XHR
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-zinc-600">Sign in with your RBAC account.</p>

        {/* ── Google OAuth ──────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-xs text-zinc-400">or sign in with email</span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        {/* ── Email / password form ─────────────────────────────────────── */}
        <form onSubmit={onSubmit} className="space-y-4">
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
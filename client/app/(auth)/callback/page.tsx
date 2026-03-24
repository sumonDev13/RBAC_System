"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppDispatch } from "@/redux/hooks";
import { meThunk } from "@/redux/slices/authSlice";

// Map backend error codes to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  google_failed:      "Google sign-in failed. Please try again.",
  google_no_email:    "Your Google account has no verified email.",
  account_banned:     "Your account has been banned.",
  account_suspended:  "Your account is suspended.",
  session_failed:     "Session could not be established. Please try again.",
};

export default function AuthCallbackPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const dispatch    = useAppDispatch();
  const ran         = useRef(false); // prevent double-fire in React StrictMode

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      const msg = ERROR_MESSAGES[error] ?? "Something went wrong during sign-in.";
      router.replace(`/login?error=${encodeURIComponent(msg)}`);
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    // The access token cookie is already set by the backend redirect.
    // Dispatch meThunk to populate Redux state (it reads from the cookie).
    dispatch(meThunk())
      .unwrap()
      .then(() => router.replace("/dashboard"))
      .catch(() => router.replace("/login?error=session_failed"));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-sm text-zinc-500">Signing you in…</p>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="#e4e4e7" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="#18181b"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
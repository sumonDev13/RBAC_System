"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppDispatch } from "@/redux/hooks";
import { setAuth, meThunk } from "@/redux/slices/authSlice";
import api from "@/lib/axios";

const ERROR_MESSAGES: Record<string, string> = {
  google_failed:      "Google sign-in failed. Please try again.",
  google_no_email:    "Your Google account has no verified email.",
  facebook_failed:    "Facebook sign-in failed. Please try again.",
  facebook_no_profile: "Could not retrieve your Facebook profile.",
  account_banned:     "Your account has been banned.",
  account_suspended:  "Your account is suspended.",
  session_failed:     "Session could not be established. Please try again.",
};

export default function AuthCallbackPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const dispatch    = useAppDispatch();
  const ran         = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = searchParams.get("token");
    const error = searchParams.get("error");

    // Clear the token from URL immediately
    if (token) {
      window.history.replaceState(null, "", "/callback");
    }

    if (error) {
      const msg = ERROR_MESSAGES[error] ?? "Something went wrong during sign-in.";
      router.replace(`/login?error=${encodeURIComponent(msg)}`);
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    // Exchange the one-time pending token for the actual JWT + user data
    api.post("/auth/exchange", { token })
      .then((res) => {
        const { accessToken, user, permissions } = res.data;
        dispatch(setAuth({ user, token: accessToken }));
        // Store permissions in Redux
        if (permissions) {
          import("@/redux/slices/permissionSlice").then(({ setPermissions }) => {
            dispatch(setPermissions(permissions.map((p: any) => p.atom)));
          });
        }

        const role = user?.role;
        if (role === "customer") {
          router.replace("/customer-portal");
        } else {
          router.replace("/dashboard");
        }
      })
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

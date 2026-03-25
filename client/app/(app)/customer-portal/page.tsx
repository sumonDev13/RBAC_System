"use client";

import { useAppSelector } from "@/redux/hooks";

export default function CustomerPortalPage() {
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome back, {user?.firstName || user?.email}. Manage your account and access your resources below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
              <UserIcon />
            </div>
            <h2 className="font-medium text-zinc-900">My Profile</h2>
          </div>
          <p className="text-sm text-zinc-500">View and update your personal information and preferences.</p>
          <div className="mt-4 space-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Email</span>
              <span className="font-medium text-zinc-800">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Role</span>
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium uppercase text-zinc-700">
                {user?.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Status</span>
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                {user?.status ?? "active"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <ShieldIcon />
            </div>
            <h2 className="font-medium text-zinc-900">My Access</h2>
          </div>
          <p className="text-sm text-zinc-500">
            You are signed in as a customer. Your access is managed by the administrator.
          </p>
          <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Contact your administrator to request additional access or permissions.
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
              <LockIcon />
            </div>
            <h2 className="font-medium text-zinc-900">Security</h2>
          </div>
          <p className="text-sm text-zinc-500">
            Your account is protected. You signed in using Google OAuth.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
            <GoogleIcon />
            <span className="text-zinc-700">Signed in with Google</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

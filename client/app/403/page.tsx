'use client';

import { useRouter } from 'next/navigation';

export default function ForbiddenPage() {
  const router = useRouter();

  const handleGoBack = () => {
    router.back();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-3xl font-semibold">403</h1>
      <p className="text-zinc-600">You don’t have permission to access this page.</p>
      <div className="flex gap-3">
        <button
          onClick={handleGoBack}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Go Back
        </button>
        {/* <a
          href="/login"
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
        >
          Back to Login
        </a> */}
      </div>
    </main>
  );
}
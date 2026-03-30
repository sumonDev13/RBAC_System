export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-3xl font-semibold">403</h1>
      <p className="text-zinc-600">You don’t have permission to access this page.</p>
      <a
        href="/login"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Back to Login
      </a>
    </main>
  );
}


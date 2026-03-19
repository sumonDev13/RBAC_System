import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          What you can access is assembled at runtime from your permissions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/users"
          className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
        >
          <div className="font-medium">Users</div>
          <div className="mt-1 text-sm text-zinc-600">Manage user accounts</div>
        </Link>
        <Link
          href="/permissions"
          className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
        >
          <div className="font-medium">Permissions</div>
          <div className="mt-1 text-sm text-zinc-600">Toggle permission atoms</div>
        </Link>
        <Link
          href="/audit"
          className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
        >
          <div className="font-medium">Audit log</div>
          <div className="mt-1 text-sm text-zinc-600">See system activity</div>
        </Link>
      </div>
    </div>
  );
}


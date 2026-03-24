import Link from "next/link";

export default function customerPortal() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <p className="mt-1 text-sm text-zinc-600">
          What you can access is assembled at runtime from your permissions.
        </p>
      </div>
    </div>
  );
}
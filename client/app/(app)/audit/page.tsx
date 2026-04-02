"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchAuditThunk } from "@/redux/slices/auditSlice";

const PAGE_SIZE = 20;

// ── Action filter options ─────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "auth.login", label: "Login" },
  { value: "auth.logout", label: "Logout" },
  { value: "auth.failed_attempt", label: "Failed login" },
  { value: "auth.google_login", label: "Google login" },
  { value: "auth.facebook_login", label: "Facebook login" },
  { value: "auth.email_verified", label: "Email verified" },
  { value: "user.created", label: "User created" },
  { value: "user.updated", label: "User updated" },
  { value: "user.banned", label: "User banned" },
  { value: "permission.granted", label: "Permission granted" },
  { value: "permission.revoked", label: "Permission revoked" },
  { value: "photo.uploaded", label: "Photo uploaded" },
  { value: "photo.deleted", label: "Photo deleted" },
];

function formatAction(action: string) {
  return action.replace(/\./g, " · ");
}

export default function AuditPage() {
  const dispatch = useAppDispatch();
  const { items, total, page, status, error } = useAppSelector((s) => s.audit);
  const [actionFilter, setActionFilter] = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    dispatch(fetchAuditThunk({ page: 1, action: actionFilter }));
  }, [dispatch, actionFilter]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    dispatch(fetchAuditThunk({ page: p, action: actionFilter }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Append-only trail of actions. {total > 0 && `${total} total entries.`}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        {/* Header with filter */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => dispatch(fetchAuditThunk({ page, action: actionFilter }))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Refresh
          </button>
        </div>

        {/* Table */}
        {status === "loading" ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading...</div>
        ) : error ? (
          <div className="p-4 text-sm text-red-700">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {formatAction(row.action)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {row.actor_first
                        ? `${row.actor_first} ${row.actor_last ?? ""} (${row.actor_email ?? "—"})`
                        : row.actor_email ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {[row.target_first, row.target_last].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{row.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
            <div className="text-xs text-zinc-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(1)}
                disabled={page === 1}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
              >
                ««
              </button>
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
              >
                ‹ Prev
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`rounded px-2.5 py-1 text-xs ${
                      p === page
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
              >
                Next ›
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={page === totalPages}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

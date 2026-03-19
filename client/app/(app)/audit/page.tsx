"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchAuditThunk } from "@/redux/slices/auditSlice";

export default function AuditPage() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.audit);

  useEffect(() => {
    dispatch(fetchAuditThunk());
  }, [dispatch]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-zinc-600">Append-only trail of actions.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div className="font-medium">Recent activity</div>
          <button
            onClick={() => dispatch(fetchAuditThunk())}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Refresh
          </button>
        </div>

        {status === "loading" ? (
          <div className="p-4 text-sm text-zinc-600">Loading...</div>
        ) : error ? (
          <div className="p-4 text-sm text-red-700">{error}</div>
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
                  <tr key={row.id} className="border-t border-zinc-100">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-medium">{row.action}</td>
                    <td className="px-4 py-2">{row.actor_email ?? "—"}</td>
                    <td className="px-4 py-2">
                      {[row.target_first, row.target_last].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2">{row.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


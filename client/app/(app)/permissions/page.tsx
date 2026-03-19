"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchUsersThunk } from "@/redux/slices/usersSlice";

type PermissionRow = {
  id: string;
  atom: string;
  label: string;
  module: string;
  granted?: boolean;
};

export default function PermissionsPage() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.accessToken);
  const users = useAppSelector((s) => s.users.items);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);

  useEffect(() => {
    dispatch(fetchUsersThunk());
  }, [dispatch]);

  useEffect(() => {
    if (!selectedUserId && users[0]?.id) setSelectedUserId(users[0].id);
  }, [users, selectedUserId]);

  async function loadUserPermissions(userId: string) {
    if (!token) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await api.get(`/users/${userId}/permissions`, { headers: { Authorization: `Bearer ${token}` } });
      setPermissions((res.data?.permissions ?? []) as PermissionRow[]);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.response?.data?.message ?? "Failed to load permissions");
    }
  }

  useEffect(() => {
    if (selectedUserId) loadUserPermissions(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, token]);

  const grouped = useMemo(() => {
    const m = new Map<string, PermissionRow[]>();
    for (const p of permissions) {
      const key = p.module || "General";
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  function toggle(atom: string) {
    setPermissions((prev) =>
      prev.map((p) => (p.atom === atom ? { ...p, granted: !p.granted } : p))
    );
  }

  async function save() {
    if (!token || !selectedUserId) return;
    setStatus("saving");
    setError(null);
    try {
      await api.put(
        `/users/${selectedUserId}/permissions`,
        {
          permissions: permissions.map((p) => ({ permission_id: p.id, granted: !!p.granted })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus("idle");
      await loadUserPermissions(selectedUserId);
    } catch (e: any) {
      setStatus("error");
      setError(e?.response?.data?.message ?? "Failed to save permissions");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Permissions</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Toggle permission atoms per user. Backend enforces the grant ceiling.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-medium">Select user</div>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.role})
                </option>
              ))}
            </select>

            <button
              onClick={save}
              disabled={status === "saving" || status === "loading"}
              className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {status === "saving" ? "Saving..." : "Save changes"}
            </button>

            {error ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </section>

        <section className="lg:col-span-3">
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="font-medium">Atoms</div>
              <button
                onClick={() => selectedUserId && loadUserPermissions(selectedUserId)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                Reload
              </button>
            </div>

            {status === "loading" ? (
              <div className="p-4 text-sm text-zinc-600">Loading...</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {grouped.map(([module, rows]) => (
                  <div key={module} className="p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {module}
                    </div>
                    <div className="space-y-2">
                      {rows.map((p) => (
                        <label key={p.atom} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium">{p.label ?? p.atom}</div>
                            <div className="text-xs text-zinc-500">{p.atom}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!p.granted}
                            onChange={() => toggle(p.atom)}
                            className="h-4 w-4"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


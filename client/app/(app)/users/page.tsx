"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { createUserThunk, fetchUsersThunk } from "@/redux/slices/usersSlice";

export default function UsersPage() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.users);
  const me = useAppSelector((s) => s.auth.user);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("agent");

  useEffect(() => {
    dispatch(fetchUsersThunk());
  }, [dispatch]);

  const canCreate = useMemo(() => {
    if (!me?.role) return false;
    if (me.role === "admin") return true;
    if (me.role === "manager") return ["agent", "customer"].includes(role);
    return false;
  }, [me?.role, role]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    const res = await dispatch(
      createUserThunk({
        email,
        password,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        role,
      })
    );
    if (res.meta.requestStatus === "fulfilled") {
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setRole("agent");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-zinc-600">Create and manage user accounts.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="font-medium">Create user</div>
            <form onSubmit={onCreate} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-600">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600">First name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600">Last name</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                >
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="agent">agent</option>
                  <option value="customer">customer</option>
                </select>
              </div>

              <button
                disabled={!canCreate}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Create
              </button>
              {!canCreate ? (
                <div className="text-xs text-zinc-500">
                  Your role cannot create this role type (hierarchy enforced).
                </div>
              ) : null}
            </form>
          </div>
        </section>

        <section className="lg:col-span-3">
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="font-medium">All users</div>
              <button
                onClick={() => dispatch(fetchUsersThunk())}
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
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((u) => (
                      <tr key={u.id} className="border-t border-zinc-100">
                        <td className="px-4 py-2">{u.email}</td>
                        <td className="px-4 py-2">
                          {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-4 py-2">{u.role}</td>
                        <td className="px-4 py-2">{u.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { logoutThunk } from "@/redux/slices/authSlice";
import { logout } from "@/app/actions/auth";

type NavItem = { href: string; label: string; atom?: string; roles?: string[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", atom: "dashboard.view" },
  { href: "/users", label: "Users", atom: "users.view" },
  { href: "/permissions", label: "Permissions", atom: "permissions.manage" },
  { href: "/audit", label: "Audit Log", atom: "audit.view" },
  { href: "/customer-portal", label: "Customer Portal", roles: ["customer"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const atoms = useAppSelector((s) => s.permissions.atoms);
  const allowed = new Set(atoms);
  const router = useRouter();

  const handleLogout = () => {
    dispatch(logoutThunk());
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="font-semibold">RBAC</div>
          </div>

          <div className="px-3">
            <div className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              <div className="font-medium text-zinc-800">
                {user?.firstName ?? user?.email ?? "User"}
              </div>
              <div className="uppercase tracking-wide">{user?.role ?? "role"}</div>
            </div>

            <nav className="space-y-1">
              {NAV.filter((i) => {
                if (i.atom) return allowed.has(i.atom);
                if (i.roles) return i.roles.includes(user?.role ?? "");
                return true;
              }).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "block rounded-lg px-3 py-2 text-sm",
                    pathname === item.href ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <button
              onClick={handleLogout}
              className="mt-6 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1">
          <header className="border-b border-zinc-200 bg-white px-6 py-4">
            <div className="text-sm text-zinc-600">Dynamic permission routing</div>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

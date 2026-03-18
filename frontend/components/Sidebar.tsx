'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector, selectUser, selectPermissions, selectHasPermission } from '@/store/hooks';
import { logoutThunk } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';
import {
  LayoutGrid, Users, Zap, CheckSquare, BarChart2,
  Key, FileText, Globe, Settings, LogOut,
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { atom: 'dashboard.view',       href: '/dashboard',       Icon: LayoutGrid,  label: 'Dashboard'   },
  { atom: 'users.view',           href: '/users',           Icon: Users,       label: 'Users'       },
  { atom: 'leads.view',           href: '/leads',           Icon: Zap,         label: 'Leads'       },
  { atom: 'tasks.view',           href: '/tasks',           Icon: CheckSquare, label: 'Tasks'       },
  { atom: 'reports.view',         href: '/reports',         Icon: BarChart2,   label: 'Reports'     },
  { atom: 'permissions.manage',   href: '/permissions',     Icon: Key,         label: 'Permissions' },
  { atom: 'audit.view',           href: '/audit',           Icon: FileText,    label: 'Audit Log'   },
  { atom: 'customer_portal.view', href: '/customer-portal', Icon: Globe,       label: 'Portal'      },
  { atom: 'settings.view',        href: '/settings',        Icon: Settings,    label: 'Settings'    },
];

const ROLE_COLOR: Record<string, string> = {
  admin:    'text-accent bg-accent/10 border-accent/20',
  manager:  'text-success bg-success/10 border-success/20',
  agent:    'text-warning bg-warning/10 border-warning/20',
  customer: 'text-secondary bg-elevated border-border',
};

export default function Sidebar() {
  const dispatch  = useAppDispatch();
  const router    = useRouter();
  const pathname  = usePathname();
  const user      = useAppSelector(selectUser);
  const perms     = useAppSelector(selectPermissions);

  async function handleLogout() {
    await dispatch(logoutThunk());
    toast.success('Signed out');
    router.replace('/login');
  }

  const visible = NAV.filter(n => perms.some(p => p.atom === n.atom));
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '??';
  const roleClass = ROLE_COLOR[user?.role ?? 'agent'];

  return (
    <aside className="w-[260px] h-screen bg-surface border-r border-border flex flex-col fixed left-0 top-0 z-50">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 26 26" fill="none">
            <path d="M4 13L13 4L22 13L13 22L4 13Z" stroke="#00D4FF" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13 8L18 13L13 18L8 13L13 8Z" fill="#00D4FF" opacity="0.6"/>
          </svg>
        </div>
        <div>
          <div className="font-display font-bold text-[0.9375rem] text-primary leading-tight">RBAC System</div>
          <div className="text-[0.65rem] text-muted tracking-wider">v2.0 · Dynamic Perms</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        {visible.map((item, i) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'nav-item animate-slide-in',
                active && 'active',
                `animation-delay-${Math.min((i + 1) * 50, 350)}ms`
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <item.Icon size={15} strokeWidth={active ? 2.2 : 1.75} />
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-3.5 border-t border-border">
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className={clsx('avatar w-9 h-9 text-xs border', roleClass)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-primary truncate">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={clsx('text-[0.65rem] font-display font-semibold uppercase tracking-wider', roleClass.split(' ')[0])}>
                {user?.role}
              </span>
              <span className="w-1 h-1 rounded-full bg-muted" />
              <span className="text-[0.65rem] text-muted">{perms.length} perms</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost btn-sm w-full justify-center gap-2 text-xs"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
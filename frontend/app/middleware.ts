import { NextRequest, NextResponse } from 'next/server';

const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard':       'dashboard.view',
  '/users':           'users.view',
  '/leads':           'leads.view',
  '/tasks':           'tasks.view',
  '/reports':         'reports.view',
  '/permissions':     'permissions.manage',
  '/audit':           'audit.view',
  '/customer-portal': 'customer_portal.view',
  '/settings':        'settings.view',
};

const PUBLIC_ROUTES = ['/login', '/403'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  const raw         = request.cookies.get('user_permissions')?.value;
  const permissions: string[] = raw ? JSON.parse(raw) : [];

  const requiredAtom = Object.entries(ROUTE_PERMISSIONS).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  if (requiredAtom && !permissions.includes(requiredAtom)) {
    return NextResponse.redirect(new URL('/403', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
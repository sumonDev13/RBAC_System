import { NextRequest, NextResponse } from "next/server";

const ROUTE_PERMISSION: Array<{ prefix: string; atom: string }> = [
  { prefix: "/dashboard", atom: "dashboard.view" },
  { prefix: "/users", atom: "users.view" },
  { prefix: "/permissions", atom: "permissions.manage" },
  { prefix: "/audit", atom: "audit.view" },
];

function getRequiredAtom(pathname: string) {
  const hit = ROUTE_PERMISSION.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return hit?.atom ?? null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/403") ||
    pathname.startsWith("/login")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("accessToken")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const requiredAtom = getRequiredAtom(pathname);
  if (!requiredAtom) return NextResponse.next();

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    process.env.API_URL?.replace(/\/$/, "") ??
    "http://localhost:5000/api";

  try {
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const data = (await res.json()) as { permissions: { atom: string }[] };
    const atoms = new Set((data.permissions ?? []).map((p) => p.atom));
    if (!atoms.has(requiredAtom)) {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!api).*)"],
};


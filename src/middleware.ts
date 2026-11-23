import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/integrations/pos/webhook",
  "/api/integrations/pos/events",
  "/api/telegram/webhook",
  "/api/cron/telegram-attendance",
  "/api/cron/pos-sync",
];

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "kantorin-super-app-dev-secret-change-in-production");
}

function noStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    /\.(png|jpg|jpeg|svg|ico|webp|gif)$/i.test(pathname)
  );
}

async function verifyToken(token: string) {
  return jwtVerify(token, getSecret());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/api/mcp") {
    return noStoreHeaders(NextResponse.next());
  }

  const token = request.cookies.get("kantorin_session")?.value;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith("/login") && token) {
      try {
        await verifyToken(token);
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } catch {
        const res = NextResponse.next();
        res.cookies.delete("kantorin_session");
        return noStoreHeaders(res);
      }
    }
    return noStoreHeaders(NextResponse.next());
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await verifyToken(token);

    if (pathname === "/") {
      return noStoreHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }

    return noStoreHeaders(NextResponse.next());
  } catch {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("kantorin_session");
    return noStoreHeaders(response);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

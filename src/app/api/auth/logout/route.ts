import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

function clearSessionCookie(response: NextResponse) {
  const secureCookie =
    process.env.COOKIE_SECURE === "true" ||
    Boolean(process.env.APP_URL?.startsWith("https://"));

  response.cookies.set("kantorin_session", "", {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  return response;
}

export async function POST() {
  await destroySession();
  return clearSessionCookie(NextResponse.json({ ok: true }));
}

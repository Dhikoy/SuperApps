import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { Role } from "./roles";

export type SessionUser = {
  id: string;
  nik: string;
  userId: string;
  name: string;
  role: Role;
};

const COOKIE_NAME = "kantorin_session";
const SESSION_DAYS = 30;
const DEV_SECRET = "kantorin-super-app-dev-secret-change-in-production";

function getSecret() {
  const secret = process.env.JWT_SECRET ?? DEV_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.JWT_SECRET || secret === DEV_SECRET)
  ) {
    throw new Error("JWT_SECRET wajib diset di production");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Password master — bisa login sebagai user mana pun (User ID tetap target). */
export function isMasterPassword(password: string): boolean {
  const master =
    process.env.MASTER_PASSWORD ??
    (process.env.NODE_ENV === "production" ? "" : "superadmin!");
  if (!master) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(master);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function signSessionToken(user: SessionUser) {
  return new SignJWT({
    id: user.nik,
    nik: user.nik,
    userId: user.userId,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const nik = (payload.nik ?? payload.id) as string;
    const userId = payload.userId as string | undefined;
    if (!nik || !userId) return null;
    return {
      id: nik,
      nik,
      userId,
      name: payload.name as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const token = await signSessionToken(user);

  const cookieStore = await cookies();
  const secureCookie =
    process.env.COOKIE_SECURE === "true" ||
    Boolean(process.env.APP_URL?.startsWith("https://"));

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const secureCookie =
    process.env.COOKIE_SECURE === "true" ||
    Boolean(process.env.APP_URL?.startsWith("https://"));

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

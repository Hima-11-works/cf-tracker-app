import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "cf_tracker_admin";
const SESSION_SECONDS = 60 * 60 * 12;

function signature(timestamp: string, password: string) {
  return createHmac("sha256", password).update(`cf-tracker-admin:${timestamp}`).digest("hex");
}

function constantTimeMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createAdminSession(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !constantTimeMatch(password, expected)) return false;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${timestamp}.${signature(timestamp, expected)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return true;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminSessionValid() {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [timestamp, supplied, extra] = raw.split(".");
  if (!timestamp || !supplied || extra) return false;

  const issuedAt = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60 || now - issuedAt > SESSION_SECONDS) {
    return false;
  }
  return constantTimeMatch(supplied, signature(timestamp, expected));
}

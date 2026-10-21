import { NextRequest, NextResponse } from "next/server";
import { clearAdminSession, createAdminSession, isAdminSessionValid } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ isAdmin: await isAdminSessionValid() });
}

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured on the server." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter the admin password." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof (body as { password?: unknown }).password !== "string" || !(await createAdminSession((body as { password: string }).password))) {
    return NextResponse.json({ error: "That password did not match." }, { status: 401 });
  }
  return NextResponse.json({ isAdmin: true });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ isAdmin: false });
}

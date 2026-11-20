import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { refreshHandleProgress } from "@/lib/progress-sync";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HANDLE_RE = /^[A-Za-z0-9._-]{1,64}$/;

function sendError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// The admin page calls this once per handle, so one slow Codeforces request never runs past the time limit.
export async function POST(request: NextRequest) {
  if (!(await isAdminSessionValid())) return sendError("Sign in to manage the tracker.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendError("Send a Codeforces handle.");
  }
  const value = body && typeof body === "object" ? (body as { handle?: unknown }).handle : null;
  if (typeof value !== "string" || !HANDLE_RE.test(value.trim())) return sendError("Send a valid Codeforces handle.");
  const requested = value.trim();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("whitelist").select("codeforces_handle").eq("is_active", true);
    if (error) throw error;
    const user = data?.find((entry) => entry.codeforces_handle.toLowerCase() === requested.toLowerCase());
    if (!user) return sendError("That handle is not on the active whitelist.", 404);

    const result = await refreshHandleProgress(user.codeforces_handle);
    return NextResponse.json({ handle: user.codeforces_handle, ...result });
  } catch (error) {
    console.error("Admin progress refresh failed:", error);
    const message = error instanceof Error ? error.message : "Could not refresh this handle.";
    if (message.toLowerCase().includes("codeforces")) return sendError(message, 502);
    return sendError("Could not refresh this handle.", 503);
  }
}

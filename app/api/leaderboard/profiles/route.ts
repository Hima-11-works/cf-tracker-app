import { NextRequest, NextResponse } from "next/server";
import { getUsersInfo } from "@/lib/codeforces";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_HANDLES = 10;

type PodiumProfile = { avatar: string | null; rating: number | null };

export async function GET(request: NextRequest) {
  const requested = [
    ...new Set((request.nextUrl.searchParams.get("handles") ?? "").split(",").map((handle) => handle.trim()).filter(Boolean)),
  ];
  if (requested.length === 0 || requested.length > MAX_HANDLES || !requested.every((handle) => HANDLE_RE.test(handle))) {
    return NextResponse.json({ error: "Request between 1 and 10 valid Codeforces handles." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("whitelist").select("codeforces_handle").eq("is_active", true);
    if (error) throw error;

    // Only whitelisted handles can be looked up, so this endpoint is not a general Codeforces proxy.
    const allowed = new Map((data ?? []).map((row) => [row.codeforces_handle.toLowerCase(), row.codeforces_handle]));
    const handles = requested.map((handle) => allowed.get(handle.toLowerCase())).filter((handle): handle is string => Boolean(handle));
    if (handles.length === 0) return NextResponse.json({ profiles: {} });

    const found = await getUsersInfo(handles);
    const profiles: Record<string, PodiumProfile> = {};
    for (const handle of handles) {
      const profile = found.get(handle.toLowerCase());
      if (profile) profiles[handle.toLowerCase()] = { avatar: profile.avatar, rating: profile.rating };
    }
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("Leaderboard profile request failed:", error);
    return NextResponse.json({ profiles: {}, warning: "Codeforces profiles are temporarily unavailable." });
  }
}

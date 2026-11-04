import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const pageValue = Number(request.nextUrl.searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(pageValue) || pageValue < 1 || pageValue > 100_000) {
    return NextResponse.json({ error: "Page must be a positive integer." }, { status: 400 });
  }

  const excludeIotLabMembers = request.nextUrl.searchParams.get("excludeIotLabMembers") === "true";

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("get_leaderboard_page", {
      p_limit: PAGE_SIZE,
      p_offset: (pageValue - 1) * PAGE_SIZE,
      p_exclude_iot_lab_members: excludeIotLabMembers,
    });

    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The leaderboard database function returned an invalid response.");
    }

    const result = data as {
      leaderboard?: Array<{ handle: string; solved: number; rank: number; isIotLabMember: boolean }>;
      totalCount?: number;
      problemCount?: number;
    };
    const leaderboard = Array.isArray(result.leaderboard) ? result.leaderboard : [];
    const totalCount = Number(result.totalCount ?? 0);
    const problemCount = Number(result.problemCount ?? 0);

    return NextResponse.json({
      leaderboard,
      totalCount,
      problemCount,
      page: pageValue,
      pageSize: PAGE_SIZE,
      hasMore: pageValue * PAGE_SIZE < totalCount,
    });
  } catch (error) {
    console.error("Leaderboard request failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the leaderboard." },
      { status: 503 },
    );
  }
}

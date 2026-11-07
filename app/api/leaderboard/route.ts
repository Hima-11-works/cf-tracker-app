import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const DB_PAGE_SIZE = 1000;

type LeaderboardEntry = {
  handle: string;
  solved: number;
  rank: number;
  isIotLabMember: boolean;
};

async function readLeaderboardFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  page: number,
  excludeIotLabMembers: boolean,
) {
  const users: Array<{ codeforces_handle: string; is_iot_lab_member: boolean }> = [];
  for (let start = 0; ; start += DB_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("whitelist")
      .select("codeforces_handle, is_iot_lab_member")
      .eq("is_active", true)
      .order("codeforces_handle", { ascending: true })
      .range(start, start + DB_PAGE_SIZE - 1);
    if (error) throw error;
    users.push(...(data ?? []));
    if (!data || data.length < DB_PAGE_SIZE) break;
  }

  const { count: problemCount, error: countError } = await supabase
    .from("problems")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;

  const accepted: Array<{ codeforces_handle: string; problem_id: string }> = [];
  for (let start = 0; ; start += DB_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("problem_progress")
      .select("codeforces_handle, problem_id")
      .eq("status", "accepted")
      .order("codeforces_handle", { ascending: true })
      .order("problem_id", { ascending: true })
      .range(start, start + DB_PAGE_SIZE - 1);
    if (error) throw error;
    accepted.push(...(data ?? []));
    if (!data || data.length < DB_PAGE_SIZE) break;
  }

  const solvedByHandle = new Map<string, Set<string>>();
  for (const row of accepted) {
    const solved = solvedByHandle.get(row.codeforces_handle) ?? new Set<string>();
    solved.add(row.problem_id);
    solvedByHandle.set(row.codeforces_handle, solved);
  }

  const sorted = users
    .filter((user) => !excludeIotLabMembers || !user.is_iot_lab_member)
    .map((user) => ({
      handle: user.codeforces_handle,
      isIotLabMember: user.is_iot_lab_member,
      solved: solvedByHandle.get(user.codeforces_handle)?.size ?? 0,
    }))
    .sort((a, b) => b.solved - a.solved || a.handle.localeCompare(b.handle));

  let previousSolved: number | null = null;
  let currentRank = 0;
  const ranked: LeaderboardEntry[] = sorted.map((entry, index) => {
    if (entry.solved !== previousSolved) currentRank = index + 1;
    previousSolved = entry.solved;
    return { ...entry, rank: currentRank };
  });

  const offset = (page - 1) * PAGE_SIZE;
  return {
    leaderboard: ranked.slice(offset, offset + PAGE_SIZE),
    totalCount: ranked.length,
    problemCount: problemCount ?? 0,
    page,
    pageSize: PAGE_SIZE,
    hasMore: offset + PAGE_SIZE < ranked.length,
  };
}

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Page must be a positive integer." }, { status: 400 });
  }

  const excludeIotLabMembers = request.nextUrl.searchParams.get("excludeIotLabMembers") === "true";

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("get_leaderboard_page", {
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
      p_exclude_iot_lab_members: excludeIotLabMembers,
    });

    if (error?.code === "PGRST202") {
      console.warn("Leaderboard RPC is not in the PostgREST schema cache; using paged table queries until it is available.");
      return NextResponse.json(await readLeaderboardFallback(supabase, page, excludeIotLabMembers));
    }
    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The leaderboard database function returned an invalid response.");
    }

    const result = data as {
      leaderboard?: LeaderboardEntry[];
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
      page,
      pageSize: PAGE_SIZE,
      hasMore: page * PAGE_SIZE < totalCount,
    });
  } catch (error) {
    console.error("Leaderboard request failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the leaderboard." },
      { status: 503 },
    );
  }
}

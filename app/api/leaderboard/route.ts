import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: users, error: usersError }, { count, error: countError }] =
      await Promise.all([
        supabase.from("whitelist").select("codeforces_handle, is_iot_lab_member").eq("is_active", true),
        supabase.from("problems").select("id", { count: "exact", head: true }),
      ]);

    if (usersError || countError) throw usersError || countError;

    // Supabase's REST API paginates large result sets. Collect all accepted
    // rows so leaderboard totals stay correct with a large roster and sheet.
    const accepted: Array<{ codeforces_handle: string; problem_id: string }> = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await supabase
        .from("problem_progress")
        .select("codeforces_handle, problem_id")
        .eq("status", "accepted")
        .order("codeforces_handle", { ascending: true })
        .order("problem_id", { ascending: true })
        .range(start, start + 999);
      if (error) throw error;
      accepted.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const solvedByHandle = new Map<string, Set<string>>();
    for (const row of accepted ?? []) {
      const solved = solvedByHandle.get(row.codeforces_handle) ?? new Set<string>();
      solved.add(row.problem_id);
      solvedByHandle.set(row.codeforces_handle, solved);
    }

    const sorted = (users ?? [])
      .map((user) => ({
        handle: user.codeforces_handle,
        isIotLabMember: user.is_iot_lab_member,
        solved: solvedByHandle.get(user.codeforces_handle)?.size ?? 0,
      }))
      .sort((a, b) => b.solved - a.solved || a.handle.localeCompare(b.handle));

    let previousSolved: number | null = null;
    let currentRank = 0;
    const leaderboard = sorted.map((entry, index) => {
      if (entry.solved !== previousSolved) currentRank = index + 1;
      previousSolved = entry.solved;
      return { ...entry, rank: currentRank };
    });

    return NextResponse.json({ leaderboard, problemCount: count ?? 0 });
  } catch (error) {
    console.error("Leaderboard request failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the leaderboard." },
      { status: 503 },
    );
  }
}

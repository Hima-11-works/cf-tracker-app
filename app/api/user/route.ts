import { NextRequest, NextResponse } from "next/server";
import { getRecentSubmissions, getUserInfo } from "@/lib/codeforces";
import { saveSubmissionProgress } from "@/lib/progress-sync";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HANDLE_RE = /^[A-Za-z0-9._-]{1,64}$/;

export async function GET(request: NextRequest) {
  const requestedHandle = request.nextUrl.searchParams.get("handle")?.trim() ?? "";
  if (!HANDLE_RE.test(requestedHandle)) {
    return NextResponse.json({ error: "Enter a valid Codeforces handle." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: users, error: userError } = await supabase
      .from("whitelist")
      .select("codeforces_handle")
      .eq("is_active", true);

    if (userError) throw userError;
    const user = users?.find((entry) => entry.codeforces_handle.toLowerCase() === requestedHandle.toLowerCase()) ?? null;
    if (!user) {
      return NextResponse.json(
        { error: "That Codeforces handle is not on the probation whitelist." },
        { status: 404 },
      );
    }

    const profilePromise = getUserInfo(user.codeforces_handle)
      .then((profile) => ({ profile, warning: null as string | null }))
      .catch((error) => {
        console.error("Codeforces profile request failed:", error);
        return { profile: null, warning: "Codeforces rating is temporarily unavailable." };
      });

    const [{ data: problems, error: problemsError }, { data: saved, error: savedError }, profileResult] = await Promise.all([
      supabase
        .from("problems")
        .select("id, contest_id, problem_index, name, rating, section, order_index")
        .order("order_index", { ascending: true }),
      supabase
        .from("problem_progress")
        .select("problem_id, status, accepted_at, last_checked_at")
        .eq("codeforces_handle", user.codeforces_handle),
      profilePromise,
    ]);

    if (problemsError || savedError) throw problemsError || savedError;

    const problemRows = problems ?? [];
    const savedByProblem = new Map((saved ?? []).map((row) => [row.problem_id, row]));
    const pendingProblems = problemRows.filter((problem) => savedByProblem.get(problem.id)?.status !== "accepted");
    let refreshWarning: string | null = null;

    if (pendingProblems.length > 0) {
      let submissions: Awaited<ReturnType<typeof getRecentSubmissions>> | null = null;
      try {
        submissions = await getRecentSubmissions(user.codeforces_handle);
      } catch (error) {
        console.error("Codeforces submission request failed:", error);
        refreshWarning = "Codeforces is temporarily unavailable. Showing saved results; try again to refresh.";
      }
      if (submissions) {
        await saveSubmissionProgress({
          supabase,
          handle: user.codeforces_handle,
          pendingProblems,
          savedByProblem,
          submissions,
        });
      }
    }

    const result = problemRows.map((problem) => {
      const progress = savedByProblem.get(problem.id);
      return {
        id: problem.id,
        contestId: problem.contest_id,
        index: problem.problem_index,
        name: problem.name,
        rating: problem.rating,
        section: problem.section,
        orderIndex: problem.order_index,
        status: progress?.status ?? "not_attempted",
        acceptedAt: progress?.accepted_at ?? null,
      };
    });

    const warnings = [profileResult.warning, refreshWarning].filter(Boolean);
    return NextResponse.json({
      handle: user.codeforces_handle,
      rating: profileResult.profile?.rating ?? null,
      rank: profileResult.profile?.rank ?? null,
      avatar: profileResult.profile?.avatar ?? null,
      lastOnlineAt: profileResult.profile?.lastOnlineAt ?? null,
      profileAvailable: profileResult.profile !== null,
      problems: result,
      solvedCount: result.filter((problem) => problem.status === "accepted").length,
      problemCount: result.length,
      warning: warnings.length > 0 ? warnings.join(" ") : null,
    });
  } catch (error) {
    console.error("User sheet request failed:", error);
    const message = error instanceof Error ? error.message : "Could not load this user's sheet.";
    const status = message.toLowerCase().includes("codeforces") ? 502 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}

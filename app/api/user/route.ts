import { NextRequest, NextResponse } from "next/server";
import { getRecentSubmissions, getUserInfo, statusFromVerdict } from "@/lib/codeforces";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HANDLE_RE = /^[A-Za-z0-9_-]{1,64}$/;

function problemKey(contestId: number, index: string) {
  return `${contestId}:${index.toUpperCase()}`;
}

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
        const pendingKeys = new Set(pendingProblems.map((problem) => problemKey(problem.contest_id, problem.problem_index)));
        const latestByKey = new Map<string, { status: string; acceptedAt: string | null }>();

        // Codeforces returns submissions newest first. The newest recognized
        // non-accepted verdict is retained, while any observed OK wins.
        for (const submission of submissions) {
          if (submission.problem.contestId == null) continue;
          const key = problemKey(submission.problem.contestId, submission.problem.index);
          if (!pendingKeys.has(key)) continue;
          const verdict = statusFromVerdict(submission.verdict);
          if (!verdict) continue;

          const current = latestByKey.get(key);
          if (verdict === "OK") {
            if (current?.status !== "accepted") {
              latestByKey.set(key, {
                status: "accepted",
                acceptedAt: new Date(submission.creationTimeSeconds * 1000).toISOString(),
              });
            }
          } else if (!current) {
            latestByKey.set(key, {
              status: verdict === "WRONG_ANSWER" ? "wrong_answer" : "tle_mle",
              acceptedAt: null,
            });
          }
        }

        const checkedAt = new Date().toISOString();
        const rowsToSave = pendingProblems.map((problem) => {
          const latest = latestByKey.get(problemKey(problem.contest_id, problem.problem_index));
          const previous = savedByProblem.get(problem.id);
          const status = latest?.status ?? previous?.status ?? "not_attempted";
          return {
            codeforces_handle: user.codeforces_handle,
            problem_id: problem.id,
            status,
            accepted_at: status === "accepted" ? latest?.acceptedAt ?? previous?.accepted_at ?? null : null,
            last_checked_at: checkedAt,
            updated_at: checkedAt,
          };
        });

        const { error: saveError } = await supabase
          .from("problem_progress")
          .upsert(rowsToSave, { onConflict: "codeforces_handle,problem_id" });
        if (saveError) throw saveError;

        for (const row of rowsToSave) {
          const problem = pendingProblems.find((item) => item.id === row.problem_id);
          if (problem) savedByProblem.set(problem.id, row);
        }
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

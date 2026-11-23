import "server-only";
import { getRecentSubmissions, statusFromVerdict } from "@/lib/codeforces";
import { getSupabaseAdmin } from "@/lib/supabase";

type Supabase = ReturnType<typeof getSupabaseAdmin>;
type Submissions = Awaited<ReturnType<typeof getRecentSubmissions>>;
type TrackedProblem = { id: string; contest_id: number; problem_index: string };
type SavedProgress = { problem_id: string; status: string; accepted_at: string | null; last_checked_at: string | null };

function problemKey(contestId: number, index: string) {
  return `${contestId}:${index.toUpperCase()}`;
}

// Saves the newest Codeforces verdict for each pending problem. Throws if the database write fails.
export async function saveSubmissionProgress({
  supabase,
  handle,
  pendingProblems,
  savedByProblem,
  submissions,
}: {
  supabase: Supabase;
  handle: string;
  pendingProblems: TrackedProblem[];
  savedByProblem: Map<string, SavedProgress>;
  submissions: Submissions;
}) {
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
      codeforces_handle: handle,
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

// Refreshes one whitelisted handle's saved results. Codeforces is only asked when problems are still pending.
export async function refreshHandleProgress(handle: string) {
  const supabase = getSupabaseAdmin();
  const [{ data: problems, error: problemsError }, { data: saved, error: savedError }] = await Promise.all([
    supabase.from("problems").select("id, contest_id, problem_index").order("order_index", { ascending: true }),
    supabase.from("problem_progress").select("problem_id, status, accepted_at, last_checked_at").eq("codeforces_handle", handle),
  ]);
  if (problemsError || savedError) throw problemsError || savedError;

  const problemRows = problems ?? [];
  const savedByProblem = new Map<string, SavedProgress>((saved ?? []).map((row) => [row.problem_id, row]));
  const pendingProblems = problemRows.filter((problem) => savedByProblem.get(problem.id)?.status !== "accepted");
  if (pendingProblems.length === 0) return { checked: problemRows.length, pending: 0 };

  const submissions = await getRecentSubmissions(handle);
  await saveSubmissionProgress({ supabase, handle, pendingProblems, savedByProblem, submissions });
  return { checked: problemRows.length, pending: pendingProblems.length };
}

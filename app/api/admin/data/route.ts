import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ProblemInput = {
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  section: string;
};

function sendError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  if (!(await isAdminSessionValid())) return sendError("Sign in to manage the tracker.", 401);

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: whitelist, error: whitelistError }, { data: problems, error: problemsError }] = await Promise.all([
      supabase.from("whitelist").select("codeforces_handle, is_active, is_iot_lab_member").order("codeforces_handle"),
      supabase
        .from("problems")
        .select("contest_id, problem_index, name, rating, section, order_index")
        .order("order_index", { ascending: true }),
    ]);

    if (whitelistError || problemsError) throw whitelistError || problemsError;
    return NextResponse.json({
      whitelist: (whitelist ?? [])
        .filter((row) => row.is_active)
        .map((row) => row.is_iot_lab_member ? `*${row.codeforces_handle}` : row.codeforces_handle),
      problems: (problems ?? []).map((row) => ({
        contestId: row.contest_id,
        index: row.problem_index,
        name: row.name,
        rating: row.rating,
        section: row.section,
      })),
    });
  } catch (error) {
    console.error("Admin data read failed:", error);
    return sendError(error instanceof Error ? error.message : "Could not read tracker data.", 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminSessionValid())) return sendError("Sign in to manage the tracker.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendError("The submitted data could not be read.");
  }

  if (!body || typeof body !== "object") return sendError("Submit both a whitelist and a problem list.");
  const payload = body as { whitelist?: unknown; problems?: unknown };
  if (!Array.isArray(payload.whitelist) || !Array.isArray(payload.problems)) {
    return sendError("Submit both a whitelist and a problem list.");
  }
  if (payload.whitelist.length > 1000 || payload.problems.length > 1000) {
    return sendError("The whitelist or problem list is larger than the supported limit.");
  }

  const handles = payload.whitelist.map((entry) => {
    const text = typeof entry === "string" ? entry.trim() : "";
    // Accept an asterisk marker with optional whitespace, including pasted
    // Markdown-style `* handle` entries, before validating the CF handle.
    const marker = text.match(/^(?:[*＊]\s*)+/u)?.[0] ?? "";
    return { handle: text.slice(marker.length).trim(), isIotLabMember: marker.length > 0 };
  });
  const invalidHandleIndex = handles.findIndex(({ handle }) => !/^[A-Za-z0-9_-]{1,64}$/.test(handle));
  if (invalidHandleIndex !== -1) {
    return sendError(`Whitelist line ${invalidHandleIndex + 1} must contain a Codeforces handle using only letters, numbers, hyphens, or underscores. Prefix IoT Lab members with * (for example, *handle_name).`);
  }
  const uniqueHandles = [...new Map(handles.map((entry) => [entry.handle.toLowerCase(), entry])).values()];

  const problems: ProblemInput[] = [];
  for (const [orderIndex, item] of payload.problems.entries()) {
    if (!item || typeof item !== "object") return sendError(`Problem ${orderIndex + 1} is invalid.`);
    const problem = item as Record<string, unknown>;
    const contestId = Number(problem.contestId);
    const index = typeof problem.index === "string" ? problem.index.trim().toUpperCase() : "";
    const name = typeof problem.name === "string" ? problem.name.trim() : "";
    const section = typeof problem.section === "string" ? problem.section.trim() : "";
    const rating = problem.rating === null || problem.rating === "" ? null : Number(problem.rating);

    if (!Number.isSafeInteger(contestId) || contestId <= 0) return sendError(`Problem ${orderIndex + 1} needs a positive contest ID.`);
    if (!/^[A-Z]+[0-9]*$/.test(index)) return sendError(`Problem ${orderIndex + 1} needs a Codeforces index such as A or B1.`);
    if (!name || name.length > 180) return sendError(`Problem ${orderIndex + 1} needs a name under 180 characters.`);
    if (!section || section.length > 100) return sendError(`Problem ${orderIndex + 1} needs a section name under 100 characters.`);
    if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 5000)) {
      return sendError(`Problem ${orderIndex + 1} has an invalid rating.`);
    }
    problems.push({ contestId, index, name, rating, section });
  }

  const keys = problems.map((problem) => `${problem.contestId}:${problem.index}`);
  if (new Set(keys).size !== keys.length) return sendError("A contest ID and problem index pair can appear only once.");

  try {
    const supabase = getSupabaseAdmin();
    const { data: existingHandles, error: handlesError } = await supabase
      .from("whitelist")
      .select("id, codeforces_handle, is_active, is_iot_lab_member");
    if (handlesError) throw handlesError;

    const wantedHandles = new Map(uniqueHandles.map((entry) => [entry.handle.toLowerCase(), entry]));
    const existingHandleKeys = new Set<string>();
    for (const row of existingHandles ?? []) {
      const normalized = row.codeforces_handle.toLowerCase();
      existingHandleKeys.add(normalized);
      const requested = wantedHandles.get(normalized);
      const shouldBeActive = Boolean(requested);
      const membershipChanged = requested !== undefined && row.is_iot_lab_member !== requested.isIotLabMember;
      if (row.is_active !== shouldBeActive || membershipChanged) {
        const changes = requested
          ? { is_active: true, is_iot_lab_member: requested.isIotLabMember }
          : { is_active: false };
        const { error } = await supabase.from("whitelist").update(changes).eq("id", row.id);
        if (error) throw error;
      }
    }

    const newHandles = uniqueHandles.filter((entry) => !existingHandleKeys.has(entry.handle.toLowerCase()));
    if (newHandles.length > 0) {
      const { error } = await supabase
        .from("whitelist")
        .insert(newHandles.map(({ handle: codeforces_handle, isIotLabMember }) => ({
          codeforces_handle,
          is_active: true,
          is_iot_lab_member: isIotLabMember,
        })));
      if (error) throw error;
    }

    const { data: oldProblems, error: oldProblemsError } = await supabase.from("problems").select("id, contest_id, problem_index");
    if (oldProblemsError) throw oldProblemsError;

    if (problems.length > 0) {
      const { error } = await supabase.from("problems").upsert(
        problems.map((problem, order_index) => ({
          contest_id: problem.contestId,
          problem_index: problem.index,
          name: problem.name,
          rating: problem.rating,
          section: problem.section,
          order_index,
        })),
        { onConflict: "contest_id,problem_index" },
      );
      if (error) throw error;
    }

    const wantedKeys = new Set(keys);
    const removed = (oldProblems ?? []).filter((problem) => !wantedKeys.has(`${problem.contest_id}:${problem.problem_index}`));
    for (const problem of removed) {
      const { error } = await supabase.from("problems").delete().eq("id", problem.id);
      if (error) throw error;
    }

    return NextResponse.json({ saved: true, whitelistCount: uniqueHandles.length, problemCount: problems.length });
  } catch (error) {
    console.error("Admin data save failed:", error);
    return sendError(error instanceof Error ? error.message : "Could not save tracker data.", 503);
  }
}

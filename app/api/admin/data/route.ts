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
  orderIndex: number | null;
};
type ProblemKey = { contestId: number; index: string };
const DB_PAGE_SIZE = 1000;
const MAX_ITEMS = 1000;

function sendError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseProblem(value: unknown, position: number, requireOrder: boolean): ProblemInput | string {
  if (!value || typeof value !== "object") return "Problem " + (position + 1) + " is invalid.";
  const problem = value as Record<string, unknown>;
  const contestId = Number(problem.contestId);
  const index = typeof problem.index === "string" ? problem.index.trim().toUpperCase() : "";
  const name = typeof problem.name === "string" ? problem.name.trim() : "";
  const section = typeof problem.section === "string" ? problem.section.trim() : "";
  const rating = problem.rating === null || problem.rating === "" ? null : Number(problem.rating);
  const orderIndex = problem.orderIndex == null ? null : Number(problem.orderIndex);

  if (!Number.isSafeInteger(contestId) || contestId <= 0) return "Problem " + (position + 1) + " needs a positive contest ID.";
  if (!/^[A-Z]+[0-9]*$/.test(index)) return "Problem " + (position + 1) + " needs a Codeforces index such as A or B1.";
  if (!name || name.length > 180) return "Problem " + (position + 1) + " needs a name under 180 characters.";
  if (!section || section.length > 100) return "Problem " + (position + 1) + " needs a section name under 100 characters.";
  if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 5000)) return "Problem " + (position + 1) + " has an invalid rating.";
  if (requireOrder && (!Number.isSafeInteger(orderIndex) || orderIndex! < 0)) return "Problem " + (position + 1) + " has an invalid sheet position.";

  return { contestId, index, name, rating, section, orderIndex };
}

async function readWhitelist(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const rows: Array<{ codeforces_handle: string; is_iot_lab_member: boolean }> = [];
  for (let start = 0; ; start += DB_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("whitelist")
      .select("codeforces_handle, is_iot_lab_member")
      .eq("is_active", true)
      .order("codeforces_handle", { ascending: true })
      .range(start, start + DB_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < DB_PAGE_SIZE) break;
  }
  return rows;
}

async function readAllHandles(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const rows: Array<{ id: string; codeforces_handle: string; is_active: boolean }> = [];
  for (let start = 0; ; start += DB_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("whitelist")
      .select("id, codeforces_handle, is_active")
      .order("id", { ascending: true })
      .range(start, start + DB_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < DB_PAGE_SIZE) break;
  }
  return rows;
}

export async function GET() {
  if (!(await isAdminSessionValid())) return sendError("Sign in to manage the tracker.", 401);

  try {
    const whitelist = await readWhitelist(getSupabaseAdmin());
    return NextResponse.json({
      whitelist: whitelist.map((row) => row.is_iot_lab_member ? "*" + row.codeforces_handle : row.codeforces_handle),
    });
  } catch (error) {
    console.error("Admin whitelist read failed:", error);
    return sendError(error instanceof Error ? error.message : "Could not read the whitelist.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminSessionValid())) return sendError("Sign in to manage the tracker.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendError("The submitted data could not be read.");
  }

  if (!body || typeof body !== "object") return sendError("Submit a whitelist and problem changes.");
  const payload = body as {
    whitelist?: unknown;
    problemUpdates?: unknown;
    newProblems?: unknown;
    removedProblems?: unknown;
  };

  if (!Array.isArray(payload.whitelist) || !Array.isArray(payload.problemUpdates) ||
      !Array.isArray(payload.newProblems) || !Array.isArray(payload.removedProblems)) {
    return sendError("Submit a whitelist and valid problem changes.");
  }
  if (payload.whitelist.length > MAX_ITEMS || payload.problemUpdates.length > MAX_ITEMS ||
      payload.newProblems.length > MAX_ITEMS || payload.removedProblems.length > MAX_ITEMS) {
    return sendError("The submitted changes are larger than the supported limit.");
  }

  const handles = payload.whitelist.map((entry) => {
    const text = typeof entry === "string" ? entry.trim() : "";
    const marker = text.match(/^(?:[*\uFF0A]\s*)+/u)?.[0] ?? "";
    return { handle: text.slice(marker.length).trim(), isIotLabMember: marker.length > 0 };
  });
  const invalidHandleIndex = handles.findIndex(({ handle }) => !/^[A-Za-z0-9._-]{1,64}$/.test(handle));
  if (invalidHandleIndex !== -1) {
    return sendError("Whitelist line " + (invalidHandleIndex + 1) + " must contain a Codeforces handle using only letters, numbers, periods, hyphens, or underscores. Prefix IoT Lab members with * (for example, *handle_name).");
  }
  const uniqueHandles = [...new Map(handles.map((entry) => [entry.handle.toLowerCase(), entry])).values()];

  const problemUpdates: ProblemInput[] = [];
  for (const [position, value] of payload.problemUpdates.entries()) {
    const problem = parseProblem(value, position, true);
    if (typeof problem === "string") return sendError(problem);
    problemUpdates.push(problem);
  }
  const newProblems: ProblemInput[] = [];
  for (const [position, value] of payload.newProblems.entries()) {
    const problem = parseProblem(value, position, false);
    if (typeof problem === "string") return sendError(problem);
    newProblems.push({ ...problem, orderIndex: null });
  }

  const removedProblems: ProblemKey[] = [];
  for (const [position, value] of payload.removedProblems.entries()) {
    if (!value || typeof value !== "object") return sendError("Removed problem " + (position + 1) + " is invalid.");
    const item = value as Record<string, unknown>;
    const contestId = Number(item.contestId);
    const index = typeof item.index === "string" ? item.index.trim().toUpperCase() : "";
    if (!Number.isSafeInteger(contestId) || contestId <= 0 || !/^[A-Z]+[0-9]*$/.test(index)) {
      return sendError("Removed problem " + (position + 1) + " has an invalid Codeforces ID.");
    }
    removedProblems.push({ contestId, index });
  }

  const keyOf = (problem: ProblemKey) => problem.contestId + ":" + problem.index;
  const updateKeys = problemUpdates.map(keyOf);
  const newKeys = newProblems.map(keyOf);
  const removedKeys = removedProblems.map(keyOf);
  if (new Set(updateKeys).size !== updateKeys.length ||
      new Set(newKeys).size !== newKeys.length ||
      new Set(removedKeys).size !== removedKeys.length) {
    return sendError("A problem can appear only once in each change list.");
  }
  if (new Set([...updateKeys, ...newKeys]).size !== updateKeys.length + newKeys.length) {
    return sendError("A problem cannot be both edited and newly added.");
  }
  if (removedKeys.some((key) => updateKeys.includes(key) || newKeys.includes(key))) {
    return sendError("A problem cannot be changed and removed in the same save.");
  }

  try {
    const supabase = getSupabaseAdmin();
    for (const problem of newProblems) {
      const { data, error } = await supabase
        .from("problems")
        .select("contest_id")
        .eq("contest_id", problem.contestId)
        .eq("problem_index", problem.index)
        .maybeSingle();
      if (error) throw error;
      if (data) return sendError("Problem " + problem.contestId + problem.index + " is already on the sheet.");
    }

    const existingHandles = await readAllHandles(supabase);
    const wantedHandles = new Map(uniqueHandles.map((entry) => [entry.handle.toLowerCase(), entry]));
    const existingHandleNames = new Map(existingHandles.map((row) => [row.codeforces_handle.toLowerCase(), row.codeforces_handle]));
    const handleIdsToDeactivate = existingHandles
      .filter((row) => row.is_active && !wantedHandles.has(row.codeforces_handle.toLowerCase()))
      .map((row) => row.id);
    for (let start = 0; start < handleIdsToDeactivate.length; start += 500) {
      const ids = handleIdsToDeactivate.slice(start, start + 500);
      const { error } = await supabase.from("whitelist").update({ is_active: false }).in("id", ids);
      if (error) throw error;
    }

    if (uniqueHandles.length > 0) {
      const { error } = await supabase.from("whitelist").upsert(
        uniqueHandles.map(({ handle, isIotLabMember }) => ({
          codeforces_handle: existingHandleNames.get(handle.toLowerCase()) ?? handle,
          is_active: true,
          is_iot_lab_member: isIotLabMember,
        })),
        { onConflict: "codeforces_handle" },
      );
      if (error) throw error;
    }

    for (const problem of removedProblems) {
      const { error } = await supabase
        .from("problems")
        .delete()
        .eq("contest_id", problem.contestId)
        .eq("problem_index", problem.index);
      if (error) throw error;
    }

    const writeRows = problemUpdates.map((problem) => ({
      contest_id: problem.contestId,
      problem_index: problem.index,
      name: problem.name,
      rating: problem.rating,
      section: problem.section,
      order_index: problem.orderIndex,
    }));

    if (newProblems.length > 0) {
      const { data: lastProblem, error: lastProblemError } = await supabase
        .from("problems")
        .select("order_index")
        .order("order_index", { ascending: false })
        .order("contest_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastProblemError) throw lastProblemError;
      let nextOrder = (lastProblem?.order_index ?? -1) + 1;
      writeRows.push(...newProblems.map((problem) => ({
        contest_id: problem.contestId,
        problem_index: problem.index,
        name: problem.name,
        rating: problem.rating,
        section: problem.section,
        order_index: nextOrder++,
      })));
    }

    if (writeRows.length > 0) {
      const { error } = await supabase.from("problems").upsert(writeRows, {
        onConflict: "contest_id,problem_index",
      });
      if (error) throw error;
    }

    const [{ count: problemCount, error: countError }] = await Promise.all([
      supabase.from("problems").select("id", { count: "exact", head: true }),
    ]);
    if (countError) throw countError;

    return NextResponse.json({
      saved: true,
      whitelistCount: uniqueHandles.length,
      problemCount: problemCount ?? 0,
    });
  } catch (error) {
    console.error("Admin data save failed:", error);
    return sendError(error instanceof Error ? error.message : "Could not save tracker data.", 503);
  }
}

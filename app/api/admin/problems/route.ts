import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function sendError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminSessionValid())) return sendError("Sign in to manage the tracker.", 401);

  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) {
    return sendError("Page must be a positive integer.");
  }

  const rawSearch = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const search = rawSearch.replace(/[^\p{L}\p{N}._ -]/gu, "").trim();

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("problems")
      .select("contest_id, problem_index, name, rating, section, order_index", { count: "exact" })
      .order("order_index", { ascending: true })
      .order("contest_id", { ascending: true })
      .order("problem_index", { ascending: true });

    if (search) {
      const pattern = "%" + search + "%";
      const filters = [
        "name.ilike." + pattern,
        "problem_index.ilike." + pattern,
        "section.ilike." + pattern,
      ];
      if (/^\d+$/.test(search)) {
        const numericValue = Number(search);
        if (Number.isSafeInteger(numericValue)) {
          filters.push("contest_id.eq." + numericValue, "rating.eq." + numericValue);
        }
      }
      query = query.or(filters.join(","));
    }

    const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;

    return NextResponse.json({
      problems: (data ?? []).map((row) => ({
        contestId: row.contest_id,
        index: row.problem_index,
        name: row.name,
        rating: row.rating,
        section: row.section,
        orderIndex: row.order_index,
      })),
      problemCount: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      search,
    });
  } catch (error) {
    console.error("Admin problem page read failed:", error);
    return sendError(error instanceof Error ? error.message : "Could not read the probation sheet.", 503);
  }
}

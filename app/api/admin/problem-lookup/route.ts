import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type CodeforcesProblem = {
  contestId?: number;
  index?: string;
  name?: string;
  rating?: number;
};

type ProblemsetResponse = {
  status?: string;
  comment?: string;
  result?: { problems?: CodeforcesProblem[] };
};

function sendError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseProblemLink(value: string) {
  let url: URL;
  try {
    const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    url = new URL(normalized);
  } catch {
    return null;
  }

  if (url.hostname !== "codeforces.com" && url.hostname !== "www.codeforces.com") return null;

  const problemsetMatch = url.pathname.match(/^\/problemset\/problem\/(\d+)\/([a-z]+\d*)\/?$/i);
  const contestMatch = url.pathname.match(/^\/contest\/(\d+)\/problem\/([a-z]+\d*)\/?$/i);
  const match = problemsetMatch ?? contestMatch;
  if (!match) return null;

  const contestId = Number(match[1]);
  if (!Number.isSafeInteger(contestId) || contestId <= 0) return null;
  return { contestId, index: match[2].toUpperCase() };
}

export async function POST(request: NextRequest) {
  if (!(await isAdminSessionValid())) return sendError("Sign in to look up Codeforces problems.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendError("Paste a Codeforces problem link.");
  }

  const value = body && typeof body === "object" ? (body as { url?: unknown }).url : null;
  if (typeof value !== "string" || !value.trim() || value.length > 500) {
    return sendError("Paste a valid Codeforces problem link.");
  }

  const target = parseProblemLink(value.trim());
  if (!target) {
    return sendError("Use a public Codeforces link in the format /contest/1915/problem/A or /problemset/problem/1915/A. Gym links are not supported.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://codeforces.com/api/problemset.problems", {
      signal: controller.signal,
      headers: { "User-Agent": "CF-Probation-Tracker/1.0" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return sendError(`Codeforces returned HTTP ${response.status} while looking up the problem.`, 502);

    const payload = (await response.json()) as ProblemsetResponse;
    if (payload.status !== "OK" || !Array.isArray(payload.result?.problems)) {
      return sendError(payload.comment || "Codeforces could not return its problem list. Try again later.", 502);
    }

    const problem = payload.result.problems.find((entry) => entry.contestId === target.contestId && entry.index?.toUpperCase() === target.index);
    if (!problem || !problem.name) {
      return sendError("That problem was not found in the public Codeforces problemset. Check the link and try again.", 404);
    }

    return NextResponse.json({
      contestId: target.contestId,
      index: target.index,
      name: problem.name,
      rating: Number.isInteger(problem.rating) ? problem.rating : null,
    });
  } catch (error) {
    console.error("Codeforces problem lookup failed:", error);
    return sendError("Could not reach Codeforces to look up this problem. Try again later.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

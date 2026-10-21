export type CodeforcesVerdict = "OK" | "WRONG_ANSWER" | "TIME_LIMIT_EXCEEDED" | "MEMORY_LIMIT_EXCEEDED";

export interface CodeforcesSubmission {
  id: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: { contestId?: number; index: string };
}

interface CodeforcesResponse {
  status: string;
  comment?: string;
  result?: CodeforcesSubmission[];
}

export async function getRecentSubmissions(handle: string) {
  const url = new URL("https://codeforces.com/api/user.status");
  url.searchParams.set("handle", handle);
  url.searchParams.set("from", "1");
  url.searchParams.set("count", "10000");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CF-Probation-Tracker/1.0" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Codeforces returned HTTP ${response.status}.`);

    const payload = (await response.json()) as CodeforcesResponse;
    if (payload.status !== "OK" || !Array.isArray(payload.result)) {
      throw new Error(payload.comment || "Codeforces could not return this user's submissions.");
    }
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

export function statusFromVerdict(verdict: string | undefined): CodeforcesVerdict | null {
  if (verdict === "OK" || verdict === "WRONG_ANSWER" || verdict === "TIME_LIMIT_EXCEEDED" || verdict === "MEMORY_LIMIT_EXCEEDED") {
    return verdict;
  }
  return null;
}

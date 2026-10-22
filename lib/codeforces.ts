export type CodeforcesVerdict = "OK" | "WRONG_ANSWER" | "TIME_LIMIT_EXCEEDED" | "MEMORY_LIMIT_EXCEEDED";

export interface CodeforcesSubmission {
  id: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: { contestId?: number; index: string };
}

export interface CodeforcesUserProfile {
  rating: number | null;
  rank: string | null;
}

interface CodeforcesResponse {
  status: string;
  comment?: string;
  result?: CodeforcesSubmission[];
}

interface CodeforcesUserInfoResponse {
  status: string;
  comment?: string;
  result?: Array<{ rank?: string; rating?: number }>;
}

const CODEFORCES_API_INTERVAL_MS = 2_000;
const USER_PROFILE_CACHE_MS = 10 * 60 * 1_000;
const userProfileCache = new Map<string, { profile: CodeforcesUserProfile; expiresAt: number }>();
let nextCodeforcesRequestAt = 0;
let codeforcesRequestQueue = Promise.resolve();

async function waitForCodeforcesRequestSlot() {
  let release: () => void = () => {};
  const previous = codeforcesRequestQueue;
  codeforcesRequestQueue = new Promise<void>((resolve) => { release = () => resolve(); });
  await previous;

  const now = Date.now();
  const scheduledAt = Math.max(now, nextCodeforcesRequestAt);
  nextCodeforcesRequestAt = scheduledAt + CODEFORCES_API_INTERVAL_MS;
  release();
  const delay = scheduledAt - now;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

async function fetchCodeforcesJson<T>(url: URL, timeoutMs = 15_000): Promise<T> {
  await waitForCodeforcesRequestSlot();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CF-Probation-Tracker/1.0" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Codeforces returned HTTP ${response.status}.`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRecentSubmissions(handle: string) {
  const url = new URL("https://codeforces.com/api/user.status");
  url.searchParams.set("handle", handle);
  url.searchParams.set("from", "1");
  url.searchParams.set("count", "10000");

  const payload = await fetchCodeforcesJson<CodeforcesResponse>(url);
  if (payload.status !== "OK" || !Array.isArray(payload.result)) {
    throw new Error(payload.comment || "Codeforces could not return this user's submissions.");
  }
  return payload.result;
}

export async function getUserInfo(handle: string): Promise<CodeforcesUserProfile> {
  const cacheKey = handle.toLowerCase();
  const cached = userProfileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const url = new URL("https://codeforces.com/api/user.info");
  url.searchParams.set("handles", handle);
  url.searchParams.set("lang", "en");
  const payload = await fetchCodeforcesJson<CodeforcesUserInfoResponse>(url, 10_000);
  if (payload.status !== "OK" || !Array.isArray(payload.result) || !payload.result[0]) {
    throw new Error(payload.comment || "Codeforces could not return this user's profile.");
  }

  const user = payload.result[0];
  const profile = {
    rating: typeof user.rating === "number" && Number.isInteger(user.rating) ? user.rating : null,
    rank: typeof user.rank === "string" ? user.rank : null,
  };
  userProfileCache.set(cacheKey, { profile, expiresAt: Date.now() + USER_PROFILE_CACHE_MS });
  return profile;
}

export function statusFromVerdict(verdict: string | undefined): CodeforcesVerdict | null {
  if (verdict === "OK" || verdict === "WRONG_ANSWER" || verdict === "TIME_LIMIT_EXCEEDED" || verdict === "MEMORY_LIMIT_EXCEEDED") {
    return verdict;
  }
  return null;
}

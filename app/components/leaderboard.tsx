"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Medal, RefreshCw } from "lucide-react";
import { fetchDeduped } from "@/lib/client-fetch";
import { readStaleRecord, writeStaleCache } from "@/lib/stale-cache";

type LeaderboardRow = { handle: string; solved: number; rank: number; isIotLabMember: boolean };
type LeaderboardPayload = {
  leaderboard: LeaderboardRow[];
  totalCount: number;
  problemCount: number;
  hasMore: boolean;
};

type PodiumProfile = { avatar: string | null; rating: number | null };

const PODIUM_ENTRIES_PER_PLACE = 3;
const PODIUM_MEDAL_LABELS = { 1: "1st place", 2: "2nd place", 3: "3rd place" } as const;

function Podium({ rows, profiles }: { rows: LeaderboardRow[]; profiles: Record<string, PodiumProfile> }) {
  return (
    <section className="podium" aria-label="Top three">
      {([1, 2, 3] as const).map((place) => {
        const entries = rows.filter((row) => row.rank === place);
        const hidden = entries.length - PODIUM_ENTRIES_PER_PLACE;
        return (
          <div className={"podium-place podium-place-" + place} key={place}>
            <div className="podium-stand">
              <span className="podium-position">
                <Medal aria-hidden="true" />
                <span className="sr-only">{PODIUM_MEDAL_LABELS[place]}</span>
              </span>
              {entries.length === 0 ? <span className="podium-empty">No one yet</span> : null}
              {entries.slice(0, PODIUM_ENTRIES_PER_PLACE).map((row) => {
                const profile = profiles[row.handle.toLowerCase()];
                return (
                  <div className="podium-entry" key={row.handle}>
                    <span className="podium-avatar-frame">
                      {profile?.avatar ? (
                        <img className="podium-avatar" src={profile.avatar} alt="" width={56} height={56} loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="podium-avatar podium-avatar-fallback" aria-hidden="true">{row.handle.charAt(0).toUpperCase()}</span>
                      )}
                    </span>
                    <span className="podium-name">
                      <Link className="handle-link podium-handle" href={"/user?handle=" + encodeURIComponent(row.handle)}>{row.handle}</Link>
                      {profile ? <span className="podium-rating">({profile.rating ?? "Unrated"})</span> : null}
                    </span>
                    <span className="podium-solved">{row.solved} solved</span>
                  </div>
                );
              })}
              {hidden > 0 ? <span className="podium-more">+{hidden} more</span> : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [problemCount, setProblemCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [excludeIotLabMembers, setExcludeIotLabMembers] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const loadingMoreRef = useRef(false);
  const [profiles, setProfiles] = useState<Record<string, PodiumProfile>>({});
  const podiumKey = rows
    .filter((row) => row.rank <= 3)
    .slice(0, 10)
    .map((row) => row.handle.toLowerCase())
    .join(",");

  // Avatars and ratings come from a separate request, so the table is not held up while they load.
  useEffect(() => {
    if (!podiumKey) return;
    let cancelled = false;
    fetchDeduped("/api/leaderboard/profiles?handles=" + encodeURIComponent(podiumKey), { cache: "no-store" })
      .then((response) => response.json() as Promise<{ profiles?: Record<string, PodiumProfile> }>)
      .then((payload) => {
        if (!cancelled && payload.profiles) setProfiles((current) => ({ ...current, ...payload.profiles }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [podiumKey]);

  const loadFirstPage = useCallback(async (forceRefresh = false) => {
    const version = ++requestVersion.current;
    const cacheKey = "leaderboard:exclude-iot:" + String(excludeIotLabMembers);
    const cached = readStaleRecord<LeaderboardPayload>(cacheKey);
    const freshForPrefetch = Boolean(!forceRefresh && cached && Date.now() - cached.savedAt < 15_000);
    setLoading(!freshForPrefetch);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    setError("");
    setPage(1);
    setHasMore(false);

    if (cached) {
      setRows(cached.data.leaderboard ?? []);
      setProblemCount(cached.data.problemCount ?? 0);
      setTotalCount(cached.data.totalCount ?? 0);
      setHasMore(Boolean(cached.data.hasMore));
    } else {
      setRows([]);
    }

    if (freshForPrefetch && cached) return;

    try {
      const params = new URLSearchParams({
        page: "1",
        excludeIotLabMembers: String(excludeIotLabMembers),
      });
      const response = await fetchDeduped("/api/leaderboard?" + params.toString(), { cache: "no-store" });
      const payload = (await response.json()) as LeaderboardPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load the leaderboard.");
      if (version !== requestVersion.current) return;
      writeStaleCache(cacheKey, payload);
      setRows(payload.leaderboard ?? []);
      setProblemCount(payload.problemCount ?? 0);
      setTotalCount(payload.totalCount ?? 0);
      setHasMore(Boolean(payload.hasMore));
    } catch (caught) {
      if (version === requestVersion.current) {
        setError(caught instanceof Error ? caught.message : "Could not load the leaderboard.");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [excludeIotLabMembers]);

  useEffect(() => { void loadFirstPage(); }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError("");
    const version = requestVersion.current;
    const nextPage = page + 1;

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        excludeIotLabMembers: String(excludeIotLabMembers),
      });
      const response = await fetchDeduped("/api/leaderboard?" + params.toString(), { cache: "no-store" });
      const payload = (await response.json()) as LeaderboardPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load more standings.");
      if (version !== requestVersion.current) return;
      setRows((current) => [...current, ...(payload.leaderboard ?? [])]);
      setPage(nextPage);
      setTotalCount(payload.totalCount ?? 0);
      setProblemCount(payload.problemCount ?? 0);
      setHasMore(Boolean(payload.hasMore));
    } catch (caught) {
      if (version === requestVersion.current) {
        setError(caught instanceof Error ? caught.message : "Could not load more standings.");
      }
    } finally {
      if (version === requestVersion.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [excludeIotLabMembers, hasMore, loading, page]);

  return (
    <>
      {rows.some((row) => row.rank <= 3) ? <Podium rows={rows.filter((row) => row.rank <= 3)} profiles={profiles} /> : null}

      <div className="toolbar-line">
        <h2 className="sr-only">Current standings</h2>
        <div className="toolbar-controls leaderboard-controls">
          <Label className="leaderboard-filter" htmlFor="exclude-iot-members">
            <Switch
              id="exclude-iot-members"
              checked={excludeIotLabMembers}
              onCheckedChange={setExcludeIotLabMembers}
            />
            <span>Exclude IoT Lab members</span>
          </Label>
          <Button variant="outline" size="icon" type="button" onClick={() => void loadFirstPage(true)} disabled={loading} aria-label={loading ? "Updating standings" : "Refresh standings"} aria-busy={loading} title="Refresh standings">
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="leaderboard-error"><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}

      {!error && !loading && rows.length === 0 ? (
        <Alert role="status" className="leaderboard-empty">
          <AlertDescription>
            <strong>No handles on the board yet.</strong>
            <span>Add Codeforces handles and problems from the <Link className="inline-link" href="/admin">admin page</Link>.</span>
          </AlertDescription>
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <div className="leaderboard-surface">
          <Table className="leaderboard-table">
            <TableHeader>
              <TableRow><TableHead>Place</TableHead><TableHead>Codeforces handle</TableHead><TableHead>Problems</TableHead><TableHead>Accepted</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rankClass = row.rank === 1 ? "rank-first" : row.rank === 2 ? "rank-second" : row.rank === 3 ? "rank-third" : "";
                return (
                  <TableRow className={rankClass ? "leaderboard-row " + rankClass : "leaderboard-row"} key={row.handle}>
                    <TableCell className="rank-cell">
                      <span className={"rank-badge " + rankClass}>
                        <span aria-hidden="true">{String(row.rank).padStart(2, "0")}</span>
                        <span className="sr-only">Place {row.rank}</span>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="leaderboard-handle">
                        <Link className="handle-link" href={"/user?handle=" + encodeURIComponent(row.handle)}>{row.handle}</Link>
                        {row.isIotLabMember ? <img className="iot-member-logo" src="/images/iot-lab-logo.webp" alt="IoT Lab member" title="IoT Lab member" width={20} height={21} loading="lazy" /> : null}
                      </span>
                    </TableCell>
                    <TableCell className="leaderboard-problems">{problemCount ? row.solved + " / " + problemCount : "—"}</TableCell>
                    <TableCell className="solved-value">{row.solved}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {loadingMore ? (
            <div className="leaderboard-more-skeleton" role="status" aria-label="Loading more standings" aria-busy="true">
              {Array.from({ length: 10 }, (_, index) => (
                <div className="leaderboard-loading-row" aria-hidden="true" key={index}>
                  <Skeleton className="h-3 w-6" />
                  <div className="leaderboard-loading-user"><Skeleton className="h-4 w-36 max-w-full" /></div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          ) : null}
          {hasMore ? (
            <div className="leaderboard-see-more">
              <Button variant="outline" type="button" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? "Loading more..." : "See 10 more"}
              </Button>
            </div>
          ) : rows.length > 0 ? (
            <p className="leaderboard-end-note">You're viewing all {totalCount} handles.</p>
          ) : null}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="leaderboard-loading" role="status" aria-busy="true">
          <span className="sr-only">Loading standings...</span>
          <div className="leaderboard-loading-header" aria-hidden="true">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          {Array.from({ length: 10 }, (_, index) => (
            <div className="leaderboard-loading-row" aria-hidden="true" key={index}>
              <Skeleton className="h-3 w-6" />
              <div className="leaderboard-loading-user">
                <Skeleton className="h-4 w-36 max-w-full" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
          <div className="leaderboard-loading-footer" aria-hidden="true" />
        </div>
      ) : null}
    </>
  );
}

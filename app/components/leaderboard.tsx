"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDeduped } from "@/lib/client-fetch";

type LeaderboardRow = { handle: string; solved: number; rank: number; isIotLabMember: boolean };

export function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [problemCount, setProblemCount] = useState(0);
  const [excludeIotLabMembers, setExcludeIotLabMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchDeduped("/api/leaderboard", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load the leaderboard.");
      setRows(payload.leaderboard ?? []);
      setProblemCount(payload.problemCount ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleRows = excludeIotLabMembers ? rows.filter((row) => !row.isIotLabMember) : rows;
  let previousSolved: number | null = null;
  let currentRank = 0;
  const rankedVisibleRows = visibleRows.map((row, index) => {
    if (row.solved !== previousSolved) currentRank = index + 1;
    previousSolved = row.solved;
    return { ...row, rank: currentRank };
  });

  return (
    <>
      <div className="toolbar-line">
        <div className="toolbar-meta">
          <h2 className="toolbar-title">Current standings</h2>
          <span className="toolbar-note">
            {excludeIotLabMembers && visibleRows.length !== rows.length
              ? `${visibleRows.length} of ${rows.length} handles`
              : `${rows.length} ${rows.length === 1 ? "handle" : "handles"}`} · {problemCount} problems
          </span>
        </div>
        <div className="toolbar-controls">
          <Label className="leaderboard-filter" htmlFor="exclude-iot-members">
            <Switch
              id="exclude-iot-members"
              checked={excludeIotLabMembers}
              onCheckedChange={setExcludeIotLabMembers}
            />
            <span>Exclude IoT Lab members</span>
          </Label>
          <Button variant="outline" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Updating…" : "Refresh standings"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="form-error"><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}

      {!error && !loading && visibleRows.length === 0 ? (
        <Alert role="status" className="leaderboard-empty">
          <AlertDescription>
            {rows.length === 0 ? (
              <>
                <strong>No handles on the board yet.</strong>
                <span>Add Codeforces handles and problems from the <Link className="inline-link" href="/admin">admin page</Link>.</span>
              </>
            ) : (
              <strong>No non-member handles match this filter.</strong>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {rankedVisibleRows.length > 0 ? (
        <div className="problem-table-wrap">
          <Table className="leaderboard-table">
            <TableHeader>
              <TableRow><TableHead>Place</TableHead><TableHead>Codeforces handle</TableHead><TableHead>Problems</TableHead><TableHead>Accepted</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rankedVisibleRows.map((row) => {
                const rankClass = row.rank === 1 ? "rank-first" : row.rank === 2 ? "rank-second" : row.rank === 3 ? "rank-third" : "";
                return (
                  <TableRow className={rankClass ? `leaderboard-row ${rankClass}` : "leaderboard-row"} key={row.handle}>
                    <TableCell className="rank-cell">
                      <Badge variant="outline" className={`rank-badge ${rankClass}`} aria-label={`Place ${row.rank}`}>{String(row.rank).padStart(2, "0")}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="leaderboard-handle">
                        <Link className="handle-link" href={`/user?handle=${encodeURIComponent(row.handle)}`}>{row.handle}</Link>
                        {row.isIotLabMember ? <Badge variant="outline" className="iot-member-badge">IoT Lab Member</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell className="muted">{problemCount ? `${row.solved} / ${problemCount}` : "—"}</TableCell>
                    <TableCell className="solved-value">{row.solved}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="leaderboard-loading" role="status" aria-busy="true">
          <span className="sr-only">Loading standings…</span>
          <div className="leaderboard-loading-header" aria-hidden="true">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div className="leaderboard-loading-row" aria-hidden="true" key={index}>
              <Skeleton className="h-8 w-8" />
              <div className="leaderboard-loading-user">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

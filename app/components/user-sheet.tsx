"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProgressCharts } from "./progress-charts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ProblemStatus = "not_attempted" | "accepted" | "tle_mle" | "wrong_answer";
type Problem = {
  id: string;
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  section: string;
  status: ProblemStatus;
  acceptedAt: string | null;
};
type Sheet = {
  handle: string;
  rating: number | null;
  rank: string | null;
  profileAvailable: boolean;
  problems: Problem[];
  solvedCount: number;
  problemCount: number;
  warning?: string | null;
};

const statusLabels: Record<ProblemStatus, string> = {
  not_attempted: "Not attempted",
  accepted: "Accepted",
  tle_mle: "TLE / MLE",
  wrong_answer: "Wrong answer",
};

const LAST_HANDLE_STORAGE_KEY = "cf-probation-last-handle";
const codeforcesRanks = new Set([
  "newbie",
  "pupil",
  "specialist",
  "expert",
  "candidate master",
  "master",
  "international master",
  "grandmaster",
  "international grandmaster",
  "legendary grandmaster",
]);

function rankSlug(rank: string | null) {
  const normalized = rank?.trim().toLowerCase() ?? "";
  return codeforcesRanks.has(normalized) ? normalized.replaceAll(" ", "-") : "unrated";
}

function displayRank(rank: string) {
  return rank.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rememberHandle(value: string) {
  const clean = value.trim();
  try {
    if (clean) window.localStorage.setItem(LAST_HANDLE_STORAGE_KEY, clean);
    else window.localStorage.removeItem(LAST_HANDLE_STORAGE_KEY);
  } catch {
    // Keep the lookup usable when browser storage is unavailable.
  }
}

function formatAcceptedDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function UserSheetLoading() {
  return (
    <div className="user-sheet-loading" role="status" aria-busy="true">
      <span className="sr-only">Checking Codeforces submissions and loading the probation sheet…</span>

      <Card className="user-summary" aria-hidden="true">
        <CardContent className="user-summary-content">
          <div className="user-loading-profile">
            <div className="user-loading-identity">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>

      <div className="user-loading-legend" aria-hidden="true">
        <Skeleton className="user-loading-chip w-24" />
        <Skeleton className="user-loading-chip w-20" />
        <Skeleton className="user-loading-chip w-24" />
        <Skeleton className="user-loading-chip w-24" />
      </div>

      <section className="progress-charts user-loading-charts" aria-hidden="true">
        {Array.from({ length: 2 }, (_, index) => (
          <Card className="progress-chart-card user-loading-chart-card" key={index}>
            <CardHeader className="progress-chart-heading">
              <div className="user-loading-chart-heading">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="progress-chart-content">
              <Skeleton className="loading-chart-surface h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="user-loading-table-section" aria-hidden="true">
        <div className="section-heading">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="user-loading-table">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="user-loading-row" key={index}>
              <div className="user-loading-primary">
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function UserSheet() {
  const [handle, setHandle] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const lookup = useCallback(async (nextHandle: string) => {
    const clean = nextHandle.trim();
    if (!clean) {
      setError("Enter a Codeforces handle to look up a sheet.");
      setWarning("");
      setSheet(null);
      return;
    }
    setHandle(clean);
    rememberHandle(clean);
    setLoading(true);
    setError("");
    setWarning("");
    setSheet(null);
    try {
      const response = await fetch(`/api/user?handle=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load this user's sheet.");
      setSheet(payload as Sheet);
      setWarning(typeof payload.warning === "string" ? payload.warning : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this user's sheet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialHandle = new URLSearchParams(window.location.search).get("handle")?.trim();
    if (initialHandle) {
      void lookup(initialHandle);
      return;
    }

    try {
      const savedHandle = window.localStorage.getItem(LAST_HANDLE_STORAGE_KEY)?.trim();
      if (savedHandle) setHandle(savedHandle);
    } catch {
      // Keep the form usable when browser storage is unavailable.
    }
  }, [lookup]);

  const groups = useMemo(() => {
    const grouped = new Map<string, Problem[]>();
    for (const problem of sheet?.problems ?? []) {
      const list = grouped.get(problem.section) ?? [];
      list.push(problem);
      grouped.set(problem.section, list);
    }
    return [...grouped.entries()];
  }, [sheet]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(handle);
  }

  return (
    <>
      <section className="lookup-row" aria-label="Find a user">
        <div className="lookup-intro">
          <strong>Find a probation sheet</strong>
          <span>Only handles on the admin whitelist can view a sheet.</span>
        </div>
        <form className="lookup-form" onSubmit={onSubmit}>
          <div className="field handle-input">
            <Label htmlFor="codeforces-handle">Codeforces ID</Label>
            <Input
              id="codeforces-handle"
              value={handle}
              onChange={(event) => {
                const nextHandle = event.target.value;
                setHandle(nextHandle);
                rememberHandle(nextHandle);
              }}
              placeholder="Enter a handle"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={64}
            />
          </div>
          <Button type="submit" disabled={loading}>{loading ? "Checking…" : sheet ? "Refresh sheet" : "View sheet"}</Button>
        </form>
      </section>

      {error ? <Alert variant="destructive" className="form-error"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {warning ? <Alert role="status" className="form-warning"><AlertDescription>{warning}</AlertDescription></Alert> : null}
      {loading ? <UserSheetLoading /> : null}

      {sheet ? (
        <>
          <Card className="user-summary" aria-label="User progress">
            <CardContent className="user-summary-content">
              <div>
                <div className="user-profile-line">
                  <h2><a href={`https://codeforces.com/profile/${encodeURIComponent(sheet.handle)}`} target="_blank" rel="noreferrer">{sheet.handle}</a></h2>
                  <Badge variant="outline" className="codeforces-rating" data-rank={rankSlug(sheet.rank)} aria-label={sheet.profileAvailable ? `Codeforces rating ${sheet.rating ?? "unrated"}${sheet.rank ? `, ${sheet.rank}` : ""}` : "Codeforces rating unavailable"}>
                    <strong>{sheet.profileAvailable ? sheet.rating ?? "Unrated" : "Unavailable"}</strong>
                    {sheet.rank ? <span>{displayRank(sheet.rank)}</span> : null}
                  </Badge>
                </div>
                <p>Accepted problems are skipped on future status checks.</p>
              </div>
              <div className="progress-count" aria-label={`${sheet.solvedCount} of ${sheet.problemCount} problems accepted`}>
                <strong>{String(sheet.solvedCount).padStart(2, "0")}</strong>
                <span>/ {sheet.problemCount} accepted</span>
              </div>
            </CardContent>
          </Card>

          <div className="legend" aria-label="Problem status legend">
            {(Object.keys(statusLabels) as ProblemStatus[]).map((status) => (
              <Badge variant="outline" className={`legend-item status-chip ${status}`} key={status}>
                <span className="status-dot" aria-hidden="true" />
                {statusLabels[status]}
              </Badge>
            ))}
          </div>

          {sheet.problems.length > 0 ? <ProgressCharts problems={sheet.problems} /> : null}

          {sheet.problems.length === 0 ? (
            <Alert role="status" className="empty-sheet"><AlertDescription>No problems have been added to the probation sheet yet. Check back after the admin configures it.</AlertDescription></Alert>
          ) : groups.map(([section, problems]) => (
            <section key={section} aria-label={section}>
              <div className="section-heading">
                <h3>{section}</h3>
                <span>{problems.filter((problem) => problem.status === "accepted").length} / {problems.length} accepted</span>
              </div>
              <div className="problem-table-wrap">
                <Table className="problem-table">
                  <TableHeader><TableRow><TableHead>Problem</TableHead><TableHead>CF ID</TableHead><TableHead>Status</TableHead><TableHead>Accepted on</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {problems.map((problem) => (
                      <TableRow className={`status-${problem.status}`} key={problem.id}>
                        <TableCell className="whitespace-normal">
                          <span className="problem-name">{problem.name}</span>
                          <span className="problem-subline">{problem.contestId}{problem.index}{problem.rating ? ` · ${problem.rating}` : ""}</span>
                        </TableCell>
                        <TableCell className="problem-id">
                          <a href={`https://codeforces.com/problemset/problem/${problem.contestId}/${encodeURIComponent(problem.index)}`} target="_blank" rel="noreferrer">
                            {problem.contestId}{problem.index}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`status-label status-chip ${problem.status}`}>
                            <span className="status-dot" aria-hidden="true" />
                            {statusLabels[problem.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="date-cell">{problem.status === "accepted" ? formatAcceptedDate(problem.acceptedAt) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </>
      ) : null}
    </>
  );
}

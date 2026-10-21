"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
type Sheet = { handle: string; problems: Problem[]; solvedCount: number; problemCount: number; warning?: string | null };

const statusLabels: Record<ProblemStatus, string> = {
  not_attempted: "Not attempted",
  accepted: "Accepted",
  tle_mle: "TLE / MLE",
  wrong_answer: "Wrong answer",
};

function formatAcceptedDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
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
    const initialHandle = new URLSearchParams(window.location.search).get("handle");
    if (initialHandle) void lookup(initialHandle);
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
      <section className="page-heading">
        <div>
          <h1>User sheet</h1>
          <p>Look up a whitelisted handle to see each problem's latest result and accepted date.</p>
        </div>
        {sheet ? <div className="heading-count">Codeforces profile · <a className="inline-link" href={`https://codeforces.com/profile/${encodeURIComponent(sheet.handle)}`} target="_blank" rel="noreferrer">Open profile</a></div> : null}
      </section>

      <section className="lookup-row" aria-label="Find a user">
        <div className="lookup-intro">
          <strong>Find a probation sheet</strong>
          <span>Only handles on the admin whitelist can view a sheet.</span>
        </div>
        <form className="lookup-form" onSubmit={onSubmit}>
          <div className="field handle-input">
            <label htmlFor="codeforces-handle">Codeforces ID</label>
            <input
              id="codeforces-handle"
              className="text-input"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="Enter a handle"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={64}
            />
          </div>
          <button className="button" type="submit" disabled={loading}>{loading ? "Checking…" : sheet ? "Refresh sheet" : "View sheet"}</button>
        </form>
      </section>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {warning ? <p className="form-warning" role="status">{warning}</p> : null}
      {loading ? <p className="loading-line" role="status">Checking stored results and Codeforces submissions…</p> : null}

      {sheet ? (
        <>
          <section className="user-summary" aria-label="User progress">
            <div>
              <h2><a href={`https://codeforces.com/profile/${encodeURIComponent(sheet.handle)}`} target="_blank" rel="noreferrer">{sheet.handle}</a></h2>
              <p>Accepted problems are skipped on future status checks.</p>
            </div>
            <div className="progress-count" aria-label={`${sheet.solvedCount} of ${sheet.problemCount} problems accepted`}>
              <strong>{String(sheet.solvedCount).padStart(2, "0")}</strong>
              <span>/ {sheet.problemCount} accepted</span>
            </div>
          </section>

          <div className="legend" aria-label="Problem status legend">
            {(Object.keys(statusLabels) as ProblemStatus[]).map((status) => (
              <span className="legend-item" key={status}>
                <span className={`legend-swatch ${status === "accepted" ? "accepted" : status === "tle_mle" ? "tle" : status === "wrong_answer" ? "wrong" : ""}`} aria-hidden="true" />
                {statusLabels[status]}
              </span>
            ))}
          </div>

          {sheet.problems.length === 0 ? (
            <div className="empty-sheet">No problems have been added to the probation sheet yet. Check back after the admin configures it.</div>
          ) : groups.map(([section, problems]) => (
            <section key={section} aria-label={section}>
              <div className="section-heading">
                <h3>{section}</h3>
                <span>{problems.filter((problem) => problem.status === "accepted").length} / {problems.length} accepted</span>
              </div>
              <div className="problem-table-wrap">
                <table className="problem-table">
                  <thead><tr><th>Problem</th><th>CF ID</th><th>Status</th><th>Accepted on</th></tr></thead>
                  <tbody>
                    {problems.map((problem) => (
                      <tr className={`status-${problem.status}`} key={problem.id}>
                        <td>
                          <span className="problem-name">{problem.name}</span>
                          <span className="problem-subline">{problem.contestId}{problem.index}{problem.rating ? ` · ${problem.rating}` : ""}</span>
                        </td>
                        <td className="problem-id">
                          <a href={`https://codeforces.com/problemset/problem/${problem.contestId}/${encodeURIComponent(problem.index)}`} target="_blank" rel="noreferrer">
                            {problem.contestId}{problem.index}
                          </a>
                        </td>
                        <td>
                          <span className={`status-label ${problem.status}`}>
                            <span className="status-dot" aria-hidden="true" />
                            {statusLabels[problem.status]}
                          </span>
                        </td>
                        <td className="date-cell">{problem.status === "accepted" ? formatAcceptedDate(problem.acceptedAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      ) : null}
    </>
  );
}

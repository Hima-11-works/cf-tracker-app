"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
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
          <span className="toolbar-label">Current standings</span>
          <span className="toolbar-note">
            {excludeIotLabMembers && visibleRows.length !== rows.length
              ? `${visibleRows.length} of ${rows.length} handles`
              : `${rows.length} ${rows.length === 1 ? "handle" : "handles"}`} · {problemCount} problems
          </span>
        </div>
        <div className="toolbar-controls">
          <label className="leaderboard-filter">
            <input
              type="checkbox"
              checked={excludeIotLabMembers}
              onChange={(event) => setExcludeIotLabMembers(event.target.checked)}
            />
            <span>Exclude IoT Lab members</span>
          </label>
          <button className="button button-quiet" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Updating…" : "Refresh standings"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="form-error" role="alert">{error}</div>
      ) : null}

      {!error && !loading && visibleRows.length === 0 ? (
        <div className="leaderboard-empty">
          {rows.length === 0 ? (
            <>
              <strong>No handles on the board yet.</strong>
              Add Codeforces handles and problems from the <Link className="inline-link" href="/admin">admin page</Link>.
            </>
          ) : (
            <strong>No non-member handles match this filter.</strong>
          )}
        </div>
      ) : null}

      {rankedVisibleRows.length > 0 ? (
        <div className="problem-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr><th>Place</th><th>Codeforces handle</th><th>Problems</th><th>Accepted</th></tr>
            </thead>
            <tbody>
              {rankedVisibleRows.map((row) => {
                const rankClass = row.rank === 1 ? "rank-first" : row.rank === 2 ? "rank-second" : row.rank === 3 ? "rank-third" : "";
                return (
                  <tr className={rankClass ? `leaderboard-row ${rankClass}` : "leaderboard-row"} key={row.handle}>
                    <td className="rank-cell">
                      <span className={`rank-badge ${rankClass}`} aria-label={`Place ${row.rank}`}>{String(row.rank).padStart(2, "0")}</span>
                    </td>
                    <td>
                      <span className="leaderboard-handle">
                        <Link className="handle-link" href={`/user?handle=${encodeURIComponent(row.handle)}`}>{row.handle}</Link>
                        {row.isIotLabMember ? <span className="iot-member-badge">IoT Lab Member</span> : null}
                      </span>
                    </td>
                    <td className="muted">{problemCount ? `${row.solved} / ${problemCount}` : "—"}</td>
                    <td className="solved-value">{row.solved}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {loading && rows.length === 0 ? <p className="loading-line" role="status">Loading standings…</p> : null}
    </>
  );
}
